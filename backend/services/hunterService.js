/**
 * Hunter.io Service
 * 1. Domain Search  — finds real HR emails for a company domain
 * 2. Email Verifier — confirms an email is deliverable before sending
 * 3. Executive fallback — CEO/CFO/CTO/Director/CXO if no HR found
 * 4. Multi-email support — returns ALL found valid emails
 *
 * Free tier: 25 searches + 50 verifications / month
 */

const https = require('https');

const HR_DEPARTMENTS = ['human resources', 'hr', 'talent', 'recruiting', 'people', 'staffing'];
const HR_POSITIONS   = ['hr', 'recruiter', 'talent', 'hiring', 'people', 'workforce', 'human resources', 'acquisition'];
const HR_GENERIC_PREFIXES = ['hr@', 'careers@', 'recruiting@', 'talent@', 'jobs@', 'people@', 'apply@', 'recruitment@'];

const EXEC_POSITIONS = [
  'ceo', 'cfo', 'cto', 'coo', 'cmo', 'cpo', 'cxo',
  'president', 'director', 'managing director',
  'founder', 'co-founder', 'vp', 'vice president',
  'head of', 'partner', 'principal', 'chief',
  'general manager', 'gm', 'country manager', 'regional director',
  'executive director', 'board member',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDomain(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const parts = parsed.hostname.replace(/^www\./, '').split('.');
    if (parts.length >= 2) return parts.slice(-2).join('.');
    return parsed.hostname;
  } catch {
    const clean = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
    const parts = clean.split('.');
    if (parts.length >= 2) return parts.slice(-2).join('.');
    return clean || null;
  }
}

function hrScore(entry) {
  let score = entry.confidence || 0;
  const dept = (entry.department || '').toLowerCase();
  const pos  = (entry.position  || '').toLowerCase();
  if (HR_DEPARTMENTS.some(k => dept.includes(k))) score += 60;
  if (HR_POSITIONS.some(k => pos.includes(k)))    score += 40;
  const val = (entry.value || '').toLowerCase();
  if (HR_GENERIC_PREFIXES.some(p => val.startsWith(p))) score += 30;
  return score;
}

function execScore(entry) {
  let score = entry.confidence || 0;
  const pos = (entry.position || '').toLowerCase();
  if (EXEC_POSITIONS.some(k => pos.includes(k))) score += 50;
  return score;
}

function isHREmail(entry) {
  const dept = (entry.department || '').toLowerCase();
  const pos  = (entry.position  || '').toLowerCase();
  const val  = (entry.value     || '').toLowerCase();
  return HR_DEPARTMENTS.some(k => dept.includes(k))
    || HR_POSITIONS.some(k => pos.includes(k))
    || HR_GENERIC_PREFIXES.some(p => val.startsWith(p));
}

function isExecEmail(entry) {
  const pos = (entry.position || '').toLowerCase();
  return EXEC_POSITIONS.some(k => pos.includes(k));
}

function httpsGet(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// ─── Hunter.io API calls ───────────────────────────────────────────────────────

async function hunterDomainSearch(domain, apiKey) {
  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=20&api_key=${encodeURIComponent(apiKey)}`;
  const res = await httpsGet(url);
  return res?.data || null;
}

/**
 * Verify a single email address with Hunter.io
 * @returns {{ deliverable: boolean, result: string, score: number }} or null on error
 *   result: 'deliverable' | 'undeliverable' | 'risky' | 'unknown'
 */
async function hunterVerifyEmail(email, apiKey) {
  const url = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${encodeURIComponent(apiKey)}`;
  const res = await httpsGet(url);
  if (!res?.data) return null;
  const d = res.data;
  return {
    result:      d.result,
    deliverable: d.result === 'deliverable',
    risky:       d.result === 'risky',
    score:       d.score || 0,
    mxRecords:   d.mx_records || false,
    smtpCheck:   d.smtp_check || false,
  };
}

/**
 * Verify a list of candidates; return those that are deliverable or risky.
 */
async function verifyCandidates(candidates, apiKey, maxVerify = 5) {
  const results = [];
  for (const candidate of candidates.slice(0, maxVerify)) {
    const v = await hunterVerifyEmail(candidate.value, apiKey);
    if (!v) {
      // quota / network fail — accept as unknown
      results.push({ ...candidate, verified: false, verifyResult: 'unknown' });
      continue;
    }
    if (v.deliverable || v.risky) {
      results.push({ ...candidate, verified: v.deliverable, verifyResult: v.result });
    }
    // undeliverable → skip
  }
  return results;
}

// ─── Main export ───────────────────────────────────────────────────────────────

/**
 * Find HR and/or executive emails for a company.
 *
 * Strategy:
 *  1. Hunter.io domain search (up to 20 results)
 *  2. Separate HR emails from executive emails
 *  3. Priority: HR > executives (CEO/CFO/CTO/Director/CXO)
 *  4. Verify top candidates for each group
 *  5. Return ALL valid emails as `emails` array — send to all of them
 *  6. `email` = primary (best HR, or best exec if no HR)
 *
 * @returns {{
 *   email: string|null,
 *   emails: string[],          -- all found valid emails (may be 1+)
 *   emailType: 'hr'|'exec'|'none',
 *   confidence: number,
 *   source: string,
 *   domain: string|null,
 *   verified: boolean,
 *   verifyResult: string,
 *   allEmails: Array<{email, confidence, position, department, verified, verifyResult, type}>
 * }}
 */
async function findHREmail(companyName, siteUrl) {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return { email: null, emails: [], emailType: 'none', confidence: 0, source: 'none', domain: null, allEmails: [] };

  const domain = extractDomain(siteUrl) || extractDomain(companyName);
  if (!domain || domain.length < 4) return { email: null, emails: [], emailType: 'none', confidence: 0, source: 'none', domain: null, allEmails: [] };

  const data = await hunterDomainSearch(domain, apiKey);
  if (!data || !Array.isArray(data.emails) || data.emails.length === 0) {
    return { email: null, emails: [], emailType: 'none', confidence: 0, source: 'hunter', domain, allEmails: [] };
  }

  // ── Partition into HR vs Executive ─────────────────────────────────────────
  const hrCandidates   = [...data.emails].filter(isHREmail).sort((a, b) => hrScore(b) - hrScore(a));
  const execCandidates = [...data.emails].filter(e => !isHREmail(e) && isExecEmail(e)).sort((a, b) => execScore(b) - execScore(a));

  // ── Verify HR first ─────────────────────────────────────────────────────────
  let verifiedHR   = hrCandidates.length > 0 ? await verifyCandidates(hrCandidates, apiKey, 4) : [];
  // If no HR found, try executives
  let verifiedExec = (verifiedHR.length === 0 && execCandidates.length > 0)
    ? await verifyCandidates(execCandidates, apiKey, 4)
    : [];

  // ── Determine primary list ──────────────────────────────────────────────────
  const primaryList = verifiedHR.length > 0 ? verifiedHR : verifiedExec;
  const emailType   = verifiedHR.length > 0 ? 'hr' : verifiedExec.length > 0 ? 'exec' : 'none';

  if (primaryList.length === 0) {
    return { email: null, emails: [], emailType: 'none', confidence: 0, source: 'hunter', domain, verifyResult: 'all_undeliverable', allEmails: [] };
  }

  // ── Build rich allEmails list (unique) ─────────────────────────────────────
  const seen      = new Set();
  const allEmails = [];
  for (const e of primaryList) {
    if (!seen.has(e.value)) {
      seen.add(e.value);
      allEmails.push({
        email:       e.value,
        confidence:  e.confidence  || 50,
        position:    e.position    || null,
        department:  e.department  || null,
        verified:    e.verified    || false,
        verifyResult: e.verifyResult || 'unknown',
        type: emailType,
      });
    }
  }

  const best = primaryList[0];

  return {
    email:        best.value,
    emails:       allEmails.map(e => e.email),
    emailType,
    confidence:   best.confidence  || 50,
    source:       'hunter',
    domain,
    verified:     best.verified    || false,
    verifyResult: best.verifyResult || 'unknown',
    position:     best.position    || null,
    department:   best.department  || null,
    allEmails,
  };
}

module.exports = { findHREmail, extractDomain, hunterVerifyEmail };
