import express from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import jsonwebtoken from 'jsonwebtoken';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: username }, { email: username }]
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'ACCOUNT EXPIRED' });
    }

    if (user.expiryDate && new Date() > user.expiryDate) {
      return res.status(403).json({ error: 'ACCOUNT EXPIRED' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jsonwebtoken.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create initial admin if none exists (for dev)
router.post('/init', async (req, res) => {
  const count = await prisma.user.count();
  if (count === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@algoforge.local',
        password: hash,
        role: 'ADMIN',
      }
    });
    res.json({ message: 'Admin created', user: admin.username });
  } else {
    res.status(400).json({ error: 'Already initialized' });
  }
});

export default router;
