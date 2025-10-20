# 🚀 Liftit V3 - Quick Start Guide

## Get up and running in 5 minutes!

### Prerequisites
- Node.js 18+ installed
- Terminal access

---

## Step 1: Navigate to Project
```bash
cd "/Users/rivu/projects v1/Liftit/LiftitV3"
```

## Step 2: Install Dependencies
```bash
npm install
```

## Step 3: Set Up Environment
```bash
# Copy the example environment file
cp .env.example .env.local
```

**Edit `.env.local` and add:**
```bash
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-this-with-openssl-rand-base64-32"
NEXT_PUBLIC_ENABLE_DEMO_LOGIN="true"
NEXT_PUBLIC_DEMO_LOGIN_USERNAME="demo-user"
NEXT_PUBLIC_DEMO_LOGIN_PASSWORD="password"
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

## Step 4: Initialize Database
```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

## Step 5: Start Development Server
```bash
npm run dev
```

## Step 6: Open in Browser
Navigate to: **http://localhost:3000**

---

## 🎯 Demo Login

Use these credentials to sign in:
- **Username**: `demo-user`
- **Password**: `password`

---

## 🎨 What You'll See

1. **Sign-In Page**: Modern authentication interface
2. **Get Started**: Welcome page with feature overview
3. **Dashboard**: Log workouts and view recent activity
4. **Progress**: Track your strength gains with charts
5. **Exercise Library**: Browse 18+ exercises with filters

---

## 🔧 Troubleshooting

### Port 3000 already in use?
```bash
# Use a different port
PORT=3001 npm run dev
```

### Database issues?
```bash
# Reset database
rm prisma/dev.db
npx prisma db push
npx prisma db seed
```

### Module not found errors?
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## 📚 Next Steps

1. **Explore the Dashboard**: Log your first workout
2. **Check Progress**: View charts after logging workouts
3. **Browse Exercises**: Explore the exercise library
4. **Read Documentation**: Check README.md for full details

---

## 🎉 You're Ready!

The app is now running at **http://localhost:3000**

Enjoy tracking your fitness journey! 💪

---

For detailed documentation, see [README.md](./README.md)  
For a complete feature list, see [REVAMP_SUMMARY.md](./REVAMP_SUMMARY.md)

