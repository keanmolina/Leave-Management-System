const nodemailer = require('nodemailer');
require('dotenv').config();

// Transporter configuration
// By default, if SMTP env variables aren't set, it uses an Ethereal test account or logs to console
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

const sendEmail = async ({ to, subject, html }) => {
  // If no SMTP credentials configured, log cleanly instead of crashing
  if (!process.env.SMTP_USER) {
    console.log('\n--- [EMAIL DISPATCH SIMULATION] ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Message:\n${html.replace(/<[^>]*>?/gm, '')}`);
    console.log('------------------------------------\n');
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"Leave Management System" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`Email delivered: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Email delivery failure:', error.message);
  }
};

module.exports = { sendEmail };