import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import { protect } from '../middleware/auth.js';
import { sendOTPEmail } from '../utils/emailService.js';
import { sendOTPSMS } from '../utils/smsService.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const generateToken = (id) =>
  jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });

// Generate 6-digit OTP code
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, mobile, otpCode, otpType = 'email' } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: 'Name, email and password required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    
    const emailLower = email.toLowerCase();
    const mobileTrim = mobile?.trim?.();
    
    // If OTP code is provided, verify it first
    if (otpCode) {
      const otpQuery = {
        purpose: 'signup',
        verified: false,
        expiresAt: { $gt: new Date() },
      };
      
      if (otpType === 'mobile' && mobileTrim) {
        otpQuery.mobile = mobileTrim;
      } else {
        otpQuery.email = emailLower;
      }
      
      const otp = await Otp.findOne(otpQuery).sort({ createdAt: -1 });
      
      if (!otp || otp.code !== otpCode) {
        return res.status(400).json({ message: 'Invalid or expired verification code' });
      }
      
      // Mark OTP as verified
      otp.verified = true;
      await otp.save();
    }
    
    const existing = await User.findOne({ email: emailLower });
    if (existing) return res.status(400).json({ message: 'Email already registered' });
    
    if (mobileTrim) {
      const existingMobile = await User.findOne({ mobile: mobileTrim });
      if (existingMobile) return res.status(400).json({ message: 'Mobile number already registered' });
    }
    const user = await User.create({
      name: name.trim(),
      email: emailLower,
      password,
      emailVerified: !!otpCode, // Mark as verified if OTP was provided
      ...(mobileTrim && { mobile: mobileTrim }),
    });
    const token = generateToken(user._id);
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      emailVerified: user.emailVerified,
      token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Signup failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });
    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: 'Invalid email or password' });
    const token = generateToken(user._id);
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Login failed' });
  }
});

router.get('/me', protect, async (req, res) => {
  res.json(req.user);
});

// Public: check if mobile number is registered (for join flow)
router.get('/check-mobile/:mobile', async (req, res) => {
  try {
    const mobile = req.params.mobile?.trim?.();
    if (!mobile) return res.status(400).json({ message: 'Mobile required' });
    const user = await User.findOne({ mobile }).select('_id');
    res.json({ exists: !!user });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Check failed' });
  }
});

// Login with mobile + password (for join flow)
router.post('/login-mobile', async (req, res) => {
  try {
    const { mobile, password } = req.body;
    const mobileTrim = mobile?.trim?.();
    if (!mobileTrim || !password) {
      return res.status(400).json({ message: 'Mobile and password required' });
    }
    const user = await User.findOne({ mobile: mobileTrim }).select('+password');
    if (!user) return res.status(401).json({ message: 'Invalid mobile or password' });
    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: 'Invalid mobile or password' });
    const token = generateToken(user._id);
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Login failed' });
  }
});

// Send OTP for email or mobile verification
router.post('/send-otp', async (req, res) => {
  try {
    const { email, mobile, purpose = 'signup', type = 'email' } = req.body;
    
    // Validate input
    if (type === 'mobile') {
      if (!mobile?.trim()) {
        return res.status(400).json({ message: 'Mobile number is required' });
      }
      const mobileTrim = mobile.trim();
      
      // For signup, check if mobile already exists
      if (purpose === 'signup') {
        const existing = await User.findOne({ mobile: mobileTrim });
        if (existing) {
          return res.status(400).json({ message: 'Mobile number already registered' });
        }
      }
      
      // Delete any existing unverified OTPs for this mobile and purpose
      await Otp.deleteMany({
        mobile: mobileTrim,
        purpose,
        verified: false,
      });
      
      // Generate new OTP
      const code = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      // Save OTP to database
      await Otp.create({
        mobile: mobileTrim,
        code,
        purpose,
        expiresAt,
      });
      
      // Generate WhatsApp link with OTP
      const smsResult = await sendOTPSMS(mobileTrim, code, purpose);
      
      res.json({ 
        message: 'Click the WhatsApp link to receive your verification code',
        whatsappLink: smsResult.whatsappLink,
        mobile: smsResult.mobile,
        // In development, return the code for testing
        ...(process.env.NODE_ENV === 'development' && { code }),
      });
    } else {
      // Email OTP (existing logic)
      if (!email?.trim()) {
        return res.status(400).json({ message: 'Email is required' });
      }
      
      const emailLower = email.toLowerCase();
      
      // For signup, check if email already exists
      if (purpose === 'signup') {
        const existing = await User.findOne({ email: emailLower });
        if (existing) {
          return res.status(400).json({ message: 'Email already registered' });
        }
      }
      
      // Delete any existing unverified OTPs for this email and purpose
      await Otp.deleteMany({
        email: emailLower,
        purpose,
        verified: false,
      });
      
      // Generate new OTP
      const code = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      // Save OTP to database
      await Otp.create({
        email: emailLower,
        code,
        purpose,
        expiresAt,
      });
      
      // Send OTP via email
      await sendOTPEmail(emailLower, code, purpose);
      
      res.json({ 
        message: 'Verification code sent to your email',
        // In development, you might want to return the code for testing
        ...(process.env.NODE_ENV === 'development' && { code }),
      });
    }
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ message: err.message || 'Failed to send verification code' });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, mobile, code, purpose = 'signup', type = 'email' } = req.body;
    
    if (type === 'mobile') {
      if (!mobile?.trim() || !code) {
        return res.status(400).json({ message: 'Mobile number and code are required' });
      }
      
      const mobileTrim = mobile.trim();
      
      // Find the most recent unverified OTP
      const otp = await Otp.findOne({
        mobile: mobileTrim,
        purpose,
        verified: false,
        expiresAt: { $gt: new Date() },
      }).sort({ createdAt: -1 });
      
      if (!otp) {
        return res.status(400).json({ message: 'Invalid or expired verification code' });
      }
      
      // Check attempts (max 5 attempts)
      if (otp.attempts >= 5) {
        return res.status(400).json({ message: 'Too many failed attempts. Please request a new code.' });
      }
      
      // Verify code
      if (otp.code !== code) {
        otp.attempts += 1;
        await otp.save();
        return res.status(400).json({ message: 'Invalid verification code' });
      }
      
      // Mark OTP as verified
      otp.verified = true;
      await otp.save();
      
      res.json({ message: 'Mobile number verified successfully' });
    } else {
      // Email verification (existing logic)
      if (!email?.trim() || !code) {
        return res.status(400).json({ message: 'Email and code are required' });
      }
      
      const emailLower = email.toLowerCase();
      
      // Find the most recent unverified OTP
      const otp = await Otp.findOne({
        email: emailLower,
        purpose,
        verified: false,
        expiresAt: { $gt: new Date() },
      }).sort({ createdAt: -1 });
      
      if (!otp) {
        return res.status(400).json({ message: 'Invalid or expired verification code' });
      }
      
      // Check attempts (max 5 attempts)
      if (otp.attempts >= 5) {
        return res.status(400).json({ message: 'Too many failed attempts. Please request a new code.' });
      }
      
      // Verify code
      if (otp.code !== code) {
        otp.attempts += 1;
        await otp.save();
        return res.status(400).json({ message: 'Invalid verification code' });
      }
      
      // Mark OTP as verified
      otp.verified = true;
      await otp.save();
      
      // If verifying for existing user, update emailVerified status
      if (purpose === 'login' || purpose === 'reset') {
        const user = await User.findOne({ email: emailLower });
        if (user) {
          user.emailVerified = true;
          await user.save();
        }
      }
      
      res.json({ message: 'Email verified successfully' });
    }
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ message: err.message || 'Verification failed' });
  }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { email, mobile, purpose = 'signup', type = 'email' } = req.body;
    
    if (type === 'mobile') {
      if (!mobile?.trim()) {
        return res.status(400).json({ message: 'Mobile number is required' });
      }
      
      const mobileTrim = mobile.trim();
      
      // Delete existing unverified OTPs
      await Otp.deleteMany({
        mobile: mobileTrim,
        purpose,
        verified: false,
      });
      
      // Generate and send new OTP
      const code = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      
      await Otp.create({
        mobile: mobileTrim,
        code,
        purpose,
        expiresAt,
      });
      
      const smsResult = await sendOTPSMS(mobileTrim, code, purpose);
      
      res.json({ 
        message: 'Click the WhatsApp link to receive your verification code',
        whatsappLink: smsResult.whatsappLink,
        mobile: smsResult.mobile,
        ...(process.env.NODE_ENV === 'development' && { code }),
      });
    } else {
      // Email resend (existing logic)
      if (!email?.trim()) {
        return res.status(400).json({ message: 'Email is required' });
      }
      
      const emailLower = email.toLowerCase();
      
      // Delete existing unverified OTPs
      await Otp.deleteMany({
        email: emailLower,
        purpose,
        verified: false,
      });
      
      // Generate and send new OTP
      const code = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      
      await Otp.create({
        email: emailLower,
        code,
        purpose,
        expiresAt,
      });
      
      await sendOTPEmail(emailLower, code, purpose);
      
      res.json({ 
        message: 'Verification code resent to your email',
        ...(process.env.NODE_ENV === 'development' && { code }),
      });
    }
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ message: err.message || 'Failed to resend verification code' });
  }
});

export default router;
