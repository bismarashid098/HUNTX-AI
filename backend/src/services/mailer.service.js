import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

/**
 * Send a job application email
 * @param {Object} options
 * @param {string} options.to - HR email address
 * @param {string} options.subject - Email subject
 * @param {string} options.body - Email body text
 * @param {string} options.senderEmail - User's email (for BCC)
 * @param {string} options.attachmentText - Tailored CV as plain text
 */
export const sendApplicationEmail = async ({ to, subject, body, senderEmail, attachmentText }) => {
  const mailOptions = {
    from: env.EMAIL_FROM,
    to,
    bcc: senderEmail, // BCC the user on their own application
    subject,
    text: body,
    attachments: attachmentText
      ? [
          {
            filename: 'CV.txt',
            content: attachmentText,
            contentType: 'text/plain',
          },
        ]
      : [],
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
};

export const verifyConnection = async () => {
  try {
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('[Mailer] Connection verification failed:', error.message);
    return false;
  }
};
