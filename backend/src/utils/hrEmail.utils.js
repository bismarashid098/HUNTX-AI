const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const HR_PREFIXES = ['hr', 'careers', 'jobs', 'recruit', 'talent', 'apply', 'hiring', 'work'];

/**
 * Tier 1: Regex scan for emails in job description text
 */
export const extractEmailsFromText = (text) => {
  const matches = text.match(EMAIL_REGEX) || [];
  // Prefer HR-related emails
  const hrEmails = matches.filter((email) => {
    const prefix = email.split('@')[0].toLowerCase();
    return HR_PREFIXES.some((p) => prefix.includes(p));
  });
  return hrEmails.length > 0 ? hrEmails[0] : (matches[0] || null);
};

/**
 * Tier 3: Heuristic fallback - construct probable HR email from company name
 */
export const inferHREmail = (companyName) => {
  if (!companyName) return null;
  const domain = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 30);
  return `careers@${domain}.com`;
};
