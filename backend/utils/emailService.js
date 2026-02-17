import nodemailer from 'nodemailer';

// Create transporter - configure with your email service
// For development, you can use Gmail with App Password or services like Ethereal Email
const createTransporter = () => {
  // Check if SMTP config is provided
  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Fallback: Gmail with App Password (for development)
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  // No email configuration found
  // In development, you can use Ethereal Email (https://ethereal.email) for testing
  // Or configure Gmail with App Password
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️  No email configuration found. OTP emails will not be sent.');
    console.warn('   Please configure SMTP_HOST/SMTP_PORT or GMAIL_USER/GMAIL_APP_PASSWORD in .env');
    console.warn('   For testing, you can use Ethereal Email: https://ethereal.email');
    // Return a mock transporter that won't actually send emails
    return {
      sendMail: async () => {
        console.log('📧 [MOCK] OTP email would be sent (email service not configured)');
        return { messageId: 'mock-message-id' };
      },
    };
  }
  
  throw new Error('Email configuration required. Please set SMTP_HOST/SMTP_PORT or GMAIL_USER/GMAIL_APP_PASSWORD');
};

export const sendOTPEmail = async (email, code, purpose = 'signup') => {
  try {
    const transporter = createTransporter();
    
    const purposes = {
      signup: 'Verify your email address',
      login: 'Login verification code',
      reset: 'Password reset code',
    };

    const subject = purposes[purpose] || 'Verification code';
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Monthly Split</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
            <h2 style="color: #333; margin-top: 0;">${subject}</h2>
            <p>Your verification code is:</p>
            <div style="background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #667eea; font-family: 'Courier New', monospace;">${code}</span>
            </div>
            <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
            <p style="color: #666; font-size: 14px; margin-top: 20px;">If you didn't request this code, please ignore this email.</p>
          </div>
        </body>
      </html>
    `;

    const text = `
Monthly Split - ${subject}

Your verification code is: ${code}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email.
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM || `"Monthly Split" <noreply@monthlysplit.com>`,
      to: email,
      subject,
      text,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    
    // In development, log success
    if (process.env.NODE_ENV === 'development') {
      console.log('Email sent! Message ID:', info.messageId);
      // If using Ethereal Email, the preview URL is in info.response
      if (info.response && info.response.includes('ethereal')) {
        console.log('Preview URL available in Ethereal Email account');
      }
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send verification email. Please try again.');
  }
};
