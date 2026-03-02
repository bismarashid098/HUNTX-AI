/**
 * CV PDF Service
 * Generates professional PDF from tailored CV JSON using Puppeteer
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCVHtml(cvData, jobTitle, company) {
  const ci      = cvData.contactInfo    || {};
  const summary = cvData.summary || cvData.profile || cvData.professionalSummary || '';
  const skills  = (cvData.skills || []).filter(Boolean);
  const experience    = cvData.experience    || [];
  const education     = cvData.education     || [];
  const certifications = cvData.certifications || [];
  const languages     = cvData.languages     || [];

  const skillChips = skills
    .map(s => `<span class="chip">${escHtml(typeof s === 'string' ? s : s?.name || '')}</span>`)
    .join('');

  const expItems = experience.map(exp => {
    const bullets = (exp.achievements || exp.responsibilities || exp.duties || [])
      .slice(0, 5)
      .map(a => `<li>${escHtml(a)}</li>`)
      .join('');
    return `
      <div class="exp-item">
        <div class="exp-header">
          <div>
            <div class="exp-role">${escHtml(exp.role || exp.title || exp.position || '')}</div>
            <div class="exp-company">${escHtml(exp.company || exp.organization || '')}</div>
          </div>
          <div class="exp-date">${escHtml(exp.duration || exp.period || exp.dates || exp.date || '')}</div>
        </div>
        ${bullets ? `<ul class="bullets">${bullets}</ul>` : ''}
      </div>`;
  }).join('');

  const eduItems = education.map(edu => `
    <div class="edu-item">
      <div>
        <div class="edu-degree">${escHtml(edu.degree || edu.qualification || edu.field || '')}</div>
        <div class="edu-inst">${escHtml(edu.institution || edu.school || edu.university || '')}</div>
      </div>
      <div class="edu-year">${escHtml(edu.year || edu.duration || edu.graduationYear || '')}</div>
    </div>`).join('');

  const certItems = certifications.map(c =>
    `<div class="cert-item">${escHtml(typeof c === 'string' ? c : c?.name || '')}</div>`
  ).join('');

  const langItems = languages.map(l =>
    `<span class="chip lang-chip">${escHtml(typeof l === 'string' ? l : l?.language || l?.name || '')}</span>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10.5pt; color: #1a202c; line-height: 1.5; background: #fff; }

  /* ── Header ── */
  .header { background: #1e3a5f; color: #fff; padding: 26px 32px 20px; }
  .name { font-size: 22pt; font-weight: 700; letter-spacing: 0.3px; }
  .tailored-for { font-size: 9.5pt; color: #93c5fd; margin-top: 3px; font-style: italic; }
  .contact-row { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; }
  .contact-item { font-size: 9pt; color: #bfdbfe; display: flex; align-items: center; gap: 4px; }

  /* ── Body ── */
  .body { padding: 20px 32px 28px; }
  .section { margin-bottom: 18px; }
  .section-title {
    font-size: 9pt; font-weight: 700; text-transform: uppercase;
    letter-spacing: 1.2px; color: #1e3a5f;
    border-bottom: 2px solid #1e3a5f; padding-bottom: 4px; margin-bottom: 10px;
  }

  /* ── Summary ── */
  .summary { font-size: 10pt; color: #374151; line-height: 1.7; }

  /* ── Skills ── */
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8;
    padding: 2px 10px; border-radius: 12px; font-size: 8.5pt; font-weight: 600;
  }
  .lang-chip { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }

  /* ── Experience ── */
  .exp-item { margin-bottom: 14px; }
  .exp-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .exp-role { font-size: 10.5pt; font-weight: 700; color: #1e3a5f; }
  .exp-company { font-size: 9.5pt; color: #2563eb; font-weight: 600; margin-top: 1px; }
  .exp-date { font-size: 8.5pt; color: #6b7280; white-space: nowrap; text-align: right; }
  .bullets { padding-left: 16px; margin-top: 6px; }
  .bullets li { font-size: 9.5pt; color: #374151; margin-bottom: 3px; line-height: 1.5; }

  /* ── Education ── */
  .edu-item { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
  .edu-degree { font-size: 10pt; font-weight: 700; color: #1e3a5f; }
  .edu-inst { font-size: 9.5pt; color: #2563eb; font-weight: 600; margin-top: 1px; }
  .edu-year { font-size: 8.5pt; color: #6b7280; white-space: nowrap; text-align: right; }

  /* ── Certs ── */
  .cert-item { font-size: 9.5pt; color: #374151; margin-bottom: 4px; padding-left: 12px; position: relative; }
  .cert-item::before { content: '▸'; position: absolute; left: 0; color: #2563eb; }

  /* ── Footer banner ── */
  .footer-banner {
    background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px;
    padding: 5px 12px; font-size: 8pt; color: #1d4ed8; font-weight: 600;
    text-align: center; margin-top: 20px;
  }
</style>
</head>
<body>

<div class="header">
  <div class="name">${escHtml(ci.name || 'Candidate')}</div>
  ${jobTitle && company ? `<div class="tailored-for">Tailored for: ${escHtml(jobTitle)} at ${escHtml(company)}</div>` : ''}
  <div class="contact-row">
    ${ci.email    ? `<span class="contact-item">✉ ${escHtml(ci.email)}</span>`    : ''}
    ${ci.phone    ? `<span class="contact-item">📞 ${escHtml(ci.phone)}</span>`    : ''}
    ${ci.location ? `<span class="contact-item">📍 ${escHtml(ci.location)}</span>` : ''}
    ${ci.linkedin ? `<span class="contact-item">🔗 ${escHtml(ci.linkedin)}</span>` : ''}
    ${ci.github   ? `<span class="contact-item">💻 ${escHtml(ci.github)}</span>`   : ''}
  </div>
</div>

<div class="body">

  ${summary ? `
  <div class="section">
    <div class="section-title">Professional Summary</div>
    <p class="summary">${escHtml(summary)}</p>
  </div>` : ''}

  ${skills.length ? `
  <div class="section">
    <div class="section-title">Core Skills</div>
    <div class="chips">${skillChips}</div>
  </div>` : ''}

  ${experience.length ? `
  <div class="section">
    <div class="section-title">Work Experience</div>
    ${expItems}
  </div>` : ''}

  ${education.length ? `
  <div class="section">
    <div class="section-title">Education</div>
    ${eduItems}
  </div>` : ''}

  ${certifications.length ? `
  <div class="section">
    <div class="section-title">Certifications</div>
    ${certItems}
  </div>` : ''}

  ${languages.length ? `
  <div class="section">
    <div class="section-title">Languages</div>
    <div class="chips">${langItems}</div>
  </div>` : ''}

  <div class="footer-banner">Generated by Digital FTE Agent — Tailored for ${escHtml(company || 'this role')}</div>
</div>

</body>
</html>`;
}

/**
 * Generate PDF files for all valid CVs in a batch (single browser instance)
 * @param {Array} cvResults - array of cvResult objects from FTE pipeline
 * @param {string} userId
 * @returns {Array} updated cvResults with cvPdfPath and hasPdf added
 */
async function generateCVPdfs(cvResults, userId) {
  const outputDir = path.join(__dirname, '../uploads/generated_cvs');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const validResults = cvResults.filter(r => r.cv && !r.error);
  if (!validResults.length) return cvResults;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();

    // Map jobId → cvPdfPath
    const pathMap = {};

    for (const result of validResults) {
      try {
        const safeName = (result.job?.company || 'company').replace(/[^a-z0-9]/gi, '_').slice(0, 30);
        const filename = `cv_${String(userId).slice(-6)}_${safeName}_${Date.now()}.pdf`;
        const outputPath = path.join(outputDir, filename);

        const html = buildCVHtml(result.cv, result.job?.title, result.job?.company);
        await page.setContent(html, { waitUntil: 'domcontentloaded' });
        await page.pdf({
          path: outputPath,
          format: 'A4',
          margin: { top: '15mm', bottom: '15mm', left: '18mm', right: '18mm' },
          printBackground: true,
        });

        pathMap[result.jobId] = outputPath;
        console.log(`[cvPdf] Generated: ${filename}`);
      } catch (err) {
        console.error(`[cvPdf] Failed for ${result.job?.company}:`, err.message);
      }
    }

    await browser.close();

    // Attach paths back to cvResults
    return cvResults.map(r => ({
      ...r,
      cvPdfPath: pathMap[r.jobId] || null,
      hasPdf:    !!pathMap[r.jobId],
    }));

  } catch (err) {
    console.error('[cvPdf] Puppeteer launch failed:', err.message);
    if (browser) await browser.close().catch(() => {});
    // Return original results without PDF paths — non-fatal
    return cvResults.map(r => ({ ...r, cvPdfPath: null, hasPdf: false }));
  }
}

/**
 * Get CV PDF path for a specific jobId from the current cvResults
 * Returns null if not found or not generated
 */
function getCVPdfPath(cvResults, jobId) {
  const result = (cvResults || []).find(r => r.jobId === jobId);
  return result?.cvPdfPath || null;
}

module.exports = { generateCVPdfs, getCVPdfPath };
