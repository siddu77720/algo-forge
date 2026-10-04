import express from 'express';
import { PrismaClient } from '@prisma/client';
import jsonwebtoken from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Middleware for admin check
const isAdmin = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded: any = jsonwebtoken.verify(token, JWT_SECRET);
    if (decoded.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

router.use(isAdmin);

router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true, role: true, active: true, expiryDate: true, createdAt: true }
  });
  res.json(users);
});

router.post('/users', async (req, res) => {
  const { username, email, password, expiryDate } = req.body;
  const hash = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: { username, email, password: hash, expiryDate: expiryDate ? new Date(expiryDate) : null }
    });
    res.json({ message: 'User created' });
  } catch(e) {
    res.status(400).json({ error: 'Could not create user' });
  }
});

router.patch('/users/:id/status', async (req, res) => {
  const { active } = req.body;
  await prisma.user.update({
    where: { id: req.params.id },
    data: { active }
  });
  res.json({ message: 'Status updated' });
});

export default router;
