import express from 'express';
import Group from '../models/Group.js';
import User from '../models/User.js';
import { protect, groupMember, groupAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public: get group name for join page (no auth)
router.get('/:groupId/join-info', async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId).select('name _id').lean();
    if (!group) return res.status(404).json({ message: 'Group not found' });
    res.json({ _id: group._id, name: group.name });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch' });
  }
});

router.use(protect);

router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Group name required' });
    const group = await Group.create({
      name: name.trim(),
      createdBy: req.user._id,
      members: [{ user: req.user._id, role: 'admin' }],
    });
    const populated = await Group.findById(group._id).populate('members.user', 'name email mobile');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to create group' });
  }
});

router.get('/', async (req, res) => {
  try {
    const groups = await Group.find({ 'members.user': req.user._id })
      .populate('members.user', 'name email mobile')
      .populate('createdBy', 'name')
      .sort({ updatedAt: -1 });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch groups' });
  }
});

router.get('/:groupId', groupMember, async (req, res) => {
  const populated = await Group.findById(req.params.groupId)
    .populate('members.user', 'name email mobile')
    .populate('createdBy', 'name');
  res.json(populated);
});

router.put('/:groupId', groupMember, groupAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (name?.trim()) req.group.name = name.trim();
    await req.group.save();
    const populated = await Group.findById(req.group._id).populate('members.user', 'name email mobile');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update group' });
  }
});

// Self-join via invite link (logged-in user adds themselves)
router.post('/:groupId/join', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const exists = group.members.some(m => m.user.toString() === req.user._id.toString());
    if (exists) return res.status(400).json({ message: 'Already a member' });
    group.members.push({ user: req.user._id, role: 'member' });
    await group.save();
    const populated = await Group.findById(group._id).populate('members.user', 'name email mobile');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to join' });
  }
});

router.post('/:groupId/members', groupMember, groupAdmin, async (req, res) => {
  try {
    const { mobile, email } = req.body;
    const mobileTrim = mobile?.trim?.();
    const emailTrim = email?.trim?.()?.toLowerCase();
    if (!mobileTrim && !emailTrim) return res.status(400).json({ message: 'Mobile number or email required' });
    const user = mobileTrim
      ? await User.findOne({ mobile: mobileTrim })
      : await User.findOne({ email: emailTrim });
    if (!user) return res.status(404).json({ message: 'User not found. They must sign up first.' });
    const exists = req.group.members.some(m => (m.user?._id || m.user).toString() === user._id.toString());
    if (exists) return res.status(400).json({ message: 'Already a member' });
    req.group.members.push({ user: user._id, role: 'member' });
    await req.group.save();
    const populated = await Group.findById(req.group._id).populate('members.user', 'name email mobile');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to add member' });
  }
});

router.delete('/:groupId/members/:userId', groupMember, groupAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const member = req.group.members.find(m => (m.user?._id || m.user)?.toString() === userId);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    if (member.role === 'admin') return res.status(400).json({ message: 'Cannot remove admin' });
    req.group.members = req.group.members.filter(m => (m.user?._id || m.user)?.toString() !== userId);
    await req.group.save();
    const populated = await Group.findById(req.group._id).populate('members.user', 'name email mobile');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to remove member' });
  }
});

router.delete('/:groupId', groupMember, groupAdmin, async (req, res) => {
  try {
    await Group.findByIdAndDelete(req.params.groupId);
    res.json({ message: 'Group deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to delete group' });
  }
});

export default router;
