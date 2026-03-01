export const cvSummaryPrompt = (cvText) => `
You are a professional CV analyzer. Extract a structured profile from this CV.

CV TEXT:
${cvText.slice(0, 8000)}

Respond with valid JSON only, no markdown, no explanation:
{
  "fullName": "string",
  "email": "string or null",
  "phone": "string or null",
  "currentTitle": "string",
  "totalYearsExperience": number,
  "topSkills": ["skill1", "skill2", "skill3"],
  "summary": "2-3 sentence professional summary",
  "keyAchievements": ["achievement1", "achievement2"]
}
`;

export const extractJobPreferencePrompt = (userMessage) => `
Extract the job title and location/city from this user message.
User said: "${userMessage}"

Respond with valid JSON only, no markdown:
{
  "jobTitle": "extracted job title or null",
  "location": "extracted city or country or null",
  "confidence": "high or medium or low"
}
`;

export const tailorCVPrompt = (cvText, cvSummary, jobTitle, jobDescription, companyName) => `
You are an expert CV writer. Tailor the candidate's CV for this specific job.

CANDIDATE PROFILE:
${JSON.stringify(cvSummary, null, 2)}

ORIGINAL CV:
${cvText.slice(0, 6000)}

TARGET JOB: ${jobTitle} at ${companyName}
JOB DESCRIPTION:
${jobDescription.slice(0, 2000)}

Instructions:
- Rewrite the professional summary to match this role
- Reorder and emphasize skills mentioned in the job description
- Rephrase experience bullet points using keywords from the job description
- Keep all dates, companies, titles, and facts accurate — never fabricate
- Output the full tailored CV as clean plain text with professional formatting

TAILORED CV:
`;

export const emailDraftPrompt = (cvSummary, jobTitle, companyName, jobDescription) => `
Write a professional job application email for this candidate.

CANDIDATE: ${cvSummary.fullName || 'the candidate'}
APPLYING FOR: ${jobTitle} at ${companyName}
TOP SKILLS: ${(cvSummary.topSkills || []).join(', ')}
KEY ACHIEVEMENTS: ${(cvSummary.keyAchievements || []).slice(0, 2).join('; ')}
JOB REQUIREMENTS EXCERPT: ${jobDescription.slice(0, 500)}

Write a concise, professional email (150-200 words) that:
- Has a compelling, specific subject line
- Opens with genuine enthusiasm for this company/role
- Highlights 2-3 most relevant achievements
- Ends with a clear call to action
- Sounds human, not robotic

Respond with valid JSON only, no markdown:
{
  "subject": "email subject line",
  "body": "full email body text"
}
`;

export const extractHREmailPrompt = (jobText, companyName) => `
Look for HR or recruitment contact email addresses in this job posting text.

JOB TEXT:
${jobText.slice(0, 3000)}

Company: ${companyName}

Rules:
- Only return emails that are explicitly present in the text
- Prefer: hr@, careers@, jobs@, recruit@, talent@, apply@, hiring@
- If no email found in text, return null

Respond with valid JSON only, no markdown:
{
  "hrEmail": "email@domain.com or null",
  "confidence": "found_in_text or not_found"
}
`;

export const offTopicResponsePrompt = (userMessage) => `
You are HuntX AI, a specialized job hunting assistant. You ONLY help with:
- CV/resume analysis and tailoring
- Job searching and applications
- Professional email writing
- Career advice related to job applications

The user said: "${userMessage}"

This message is not related to job hunting. Politely redirect them to job-related topics.
Keep your response under 2 sentences. Be friendly but firm.
`;
