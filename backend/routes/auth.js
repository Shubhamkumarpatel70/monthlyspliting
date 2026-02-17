import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const generateToken = (id) =>
  jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, mobile } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: 'Name, email and password required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ message: 'Email already registered' });
    const mobileTrim = mobile?.trim?.();
    if (mobileTrim) {
      const existingMobile = await User.findOne({ mobile: mobileTrim });
      if (existingMobile) return res.status(400).json({ message: 'Mobile number already registered' });
    }
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password,
      ...(mobileTrim && { mobile: mobileTrim }),
    });
    const token = generateToken(user._id);
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
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

export default router;
