const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  async sendApplicationEmail({ to, subject, body, cvPath, userName, companyName }) {
    try {
      // Validate inputs
      if (!to || !subject || !body) {
        throw new Error('To, subject, and body are required');
      }

      // Email configuration
      const mailOptions = {
        from: {
          name: userName || 'Job Applicant',
          address: process.env.EMAIL_USER
        },
        to: to,
        subject: subject,
        html: this.formatEmailBody(body, userName, companyName),
        attachments: []
      };

      // Attach CV if provided
      if (cvPath && fs.existsSync(cvPath)) {
        mailOptions.attachments.push({
          filename: path.basename(cvPath),
          path: cvPath,
          contentType: 'application/pdf'
        });
      }

      // Send email
      const result = await this.transporter.sendMail(mailOptions);
      
      console.log(`Application email sent successfully to ${to}`);
      return {
        success: true,
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected
      };
    } catch (error) {
      console.error('Email sending error:', error);
      throw new Error(`Failed to send application email: ${error.message}`);
    }
  }

  formatEmailBody(body, userName, companyName) {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Job Application</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { margin-bottom: 30px; }
          .content { margin-bottom: 30px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
          .signature { margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <p><strong>${currentDate}</strong></p>
          </div>
          
          <div class="content">
            ${body.replace(/\n/g, '<br>')}
          </div>
          
          <div class="signature">
            <p>Best regards,</p>
            <p><strong>${userName || 'Job Applicant'}</strong></p>
          </div>
          
          <div class="footer">
            <p style="font-size: 12px; color: #666;">
              This email was sent automatically through the Job Application Agent system.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  async sendPasswordResetEmail({ to, name, resetUrl }) {
    const mailOptions = {
      from: { name: 'Talvion AI', address: process.env.EMAIL_USER },
      to,
      subject: 'Reset your Talvion AI password',
      html: this.formatResetEmail(name, resetUrl),
    };
    await this.transporter.sendMail(mailOptions);
  }

  formatResetEmail(name, resetUrl) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#05070f;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;padding:0 16px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-flex;align-items:center;gap:10px;">
        <div style="width:40px;height:40px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;display:inline-block;"></div>
        <span style="color:#f1f5f9;font-size:1.1rem;font-weight:800;letter-spacing:-0.02em;">Talvion AI</span>
      </div>
    </div>
    <!-- Card -->
    <div style="background:#0f1425;border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:36px 32px;box-shadow:0 8px 40px rgba(0,0,0,0.5);">
      <h1 style="color:#f1f5f9;font-size:1.4rem;font-weight:800;margin:0 0 8px;letter-spacing:-0.02em;">Reset your password</h1>
      <p style="color:#64748b;font-size:0.9rem;margin:0 0 28px;line-height:1.6;">
        Hi ${name || 'there'}, we received a request to reset your Talvion AI password.
        Click the button below to set a new password. This link expires in <strong style="color:#a5b4fc;">1 hour</strong>.
      </p>
      <!-- Button -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="${resetUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-weight:700;font-size:0.9rem;text-decoration:none;padding:14px 36px;border-radius:10px;box-shadow:0 2px 14px rgba(99,102,241,0.4);">
          Reset Password
        </a>
      </div>
      <!-- Divider -->
      <div style="height:1px;background:rgba(255,255,255,0.06);margin:0 0 20px;"></div>
      <p style="color:#475569;font-size:0.78rem;margin:0;line-height:1.6;">
        If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.<br><br>
        Or copy this link into your browser:<br>
        <span style="color:#818cf8;word-break:break-all;font-size:0.73rem;">${resetUrl}</span>
      </p>
    </div>
    <!-- Footer -->
    <p style="text-align:center;color:#1e293b;font-size:0.7rem;margin-top:24px;">
      © ${new Date().getFullYear()} Talvion AI · All rights reserved
    </p>
  </div>
</body>
</html>`;
  }

  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('Email service connection verified');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }

  async testEmail() {
    try {
      const testResult = await this.sendApplicationEmail({
        to: process.env.EMAIL_USER, // Send to self for testing
        subject: 'Test Email - Job Application Agent',
        body: 'This is a test email to verify the email service is working correctly.',
        userName: 'Test User'
      });
      
      return testResult;
    } catch (error) {
      console.error('Test email failed:', error);
      throw error;
    }
  }
}

const emailService = new EmailService();
module.exports = { emailService };