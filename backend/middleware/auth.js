import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Group from '../models/Group.js';

export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  try {
    const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized' });
  }
};

export const groupMember = async (req, res, next) => {
  const group = await Group.findById(req.params.groupId).populate('members.user', 'name email mobile');
  if (!group) return res.status(404).json({ message: 'Group not found' });
  const isMember = group.members.some(m => (m.user?._id || m.user)?.toString() === req.user._id.toString());
  if (!isMember) return res.status(403).json({ message: 'Not a member of this group' });
  req.group = group;
  next();
};

export const groupAdmin = async (req, res, next) => {
  const admin = req.group.members.find(m => (m.user?._id || m.user)?.toString() === req.user._id.toString());
  if (!admin || admin.role !== 'admin') {
    return res.status(403).json({ message: 'Admin only' });
  }
  next();
};

export const isAdmin = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};
