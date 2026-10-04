# AlgoForge OTC Signal Dashboard

A complete full-stack web application for monitoring OTC market pairs and generating manual trading signals based on a strictly defined candle setup strategy.

## Tech Stack
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Lightweight Charts, Zustand/Context, Socket.IO Client.
- **Backend**: Node.js, Express, Socket.IO, Prisma ORM, JWT Authentication.
- **Database**: SQLite (Configured to be production-ready fallback when PostgreSQL is unavailable).

## Installation

1. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

## Setup

1. Run Prisma migrations and generate client (in `backend` folder):
   ```bash
   npx prisma db push
   npx prisma generate
   ```

2. Initialize the admin user by sending a POST request or running the backend:
   ```bash
   # Start backend
   npm run dev
   # In another terminal:
   curl -X POST http://localhost:5000/api/auth/init
   ```

## Running the Application

1. Start backend:
   ```bash
   cd backend
   npm run dev
   ```

2. Start frontend:
   ```bash
   cd frontend
   npm run dev
   ```

## Default Admin Credentials
- **Username**: `admin` or **Email**: `admin@algoforge.local`
- **Password**: `admin123`

## Strategy
1. **Base Candle**: 1-minute base candle identified.
2. **Base Confirmation**: Next 2 candles close within the base candle's wick range.
3. **Breakout**: A candle closes outside the base candle's high or low.
4. **Breakout Confirmation**: Next 2 candles close within the breakout candle's wick range.
5. **Entry Signal**: Generated for the NEXT candle, opposite to the breakout direction (Upper -> PUT, Lower -> CALL).
6. **Gap Filter**: If the entry candle opens with a gap up or gap down, the setup is invalidated.
