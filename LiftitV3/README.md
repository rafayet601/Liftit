# Liftit V3 - Modern Fitness Tracking Application

<div align="center">
  <h3>🏋️ Your Ultimate Fitness Companion</h3>
  <p>Track workouts, monitor progress, and achieve your fitness goals with data-driven insights</p>
</div>

## ✨ Features

### Core Functionality
- **🔐 Secure Authentication**: Support for credentials-based login and OAuth providers (GitHub, Google, Apple)
- **📝 Workout Logging**: Intuitive interface for tracking exercises, sets, reps, weight, and RPE
- **📊 Progress Tracking**: Beautiful charts visualizing strength gains and workout volume over time
- **🎯 Personal Records**: Automatic detection and celebration of PRs
- **💪 Exercise Library**: Browse comprehensive exercise database (coming soon)
- **📱 Responsive Design**: Mobile-first, works seamlessly on all devices

### Modern Tech Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript for type safety
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI primitives with shadcn/ui
- **Animations**: Framer Motion for smooth transitions
- **Database**: Prisma ORM with SQLite (easily switchable to PostgreSQL)
- **Authentication**: NextAuth.js v4
- **Charts**: Recharts for data visualization

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- SQLite (default) or PostgreSQL

### Installation

1. **Clone the repository**
   ```bash
   cd /path/to/LiftitV3
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```bash
   # Database
   DATABASE_URL="file:./dev.db"

   # NextAuth Configuration
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key-here"  # Generate with: openssl rand -base64 32

   # Demo Login (Development Only - REMOVE IN PRODUCTION)
   NEXT_PUBLIC_ENABLE_DEMO_LOGIN="true"
   NEXT_PUBLIC_DEMO_LOGIN_USERNAME="demo-user"
   NEXT_PUBLIC_DEMO_LOGIN_PASSWORD="password"

   # OAuth Providers (Optional)
   GITHUB_ID="your-github-oauth-id"
   GITHUB_SECRET="your-github-oauth-secret"
   GOOGLE_ID="your-google-oauth-id"
   GOOGLE_SECRET="your-google-oauth-secret"
   ```

4. **Initialize the database**
   ```bash
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Development Credentials
For development purposes, you can use:
- **Username**: `demo-user`
- **Password**: `password`

> ⚠️ **Security Note**: Always disable demo credentials in production by setting `NEXT_PUBLIC_ENABLE_DEMO_LOGIN="false"`

## 📁 Project Structure

```
LiftitV3/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/         # Authentication endpoints
│   │   ├── workouts/     # Workout CRUD operations
│   │   └── progress/     # Progress tracking endpoints
│   ├── auth/             # Authentication pages
│   ├── dashboard/        # Main dashboard
│   ├── get-started/      # Onboarding page
│   ├── progress/         # Progress tracking page
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/           # React components
│   ├── auth/            # Auth-related components
│   ├── ui/              # Reusable UI components
│   ├── ProgressTracker.tsx
│   └── WorkoutForm.tsx
├── lib/                 # Utility functions
│   ├── prisma.ts       # Prisma client
│   ├── progressiveOverload.ts
│   └── utils.ts
├── prisma/             # Database
│   ├── schema.prisma   # Database schema
│   └── seed.js         # Seed data
├── types/              # TypeScript definitions
└── public/             # Static assets
```

## 🔐 OAuth Configuration

### GitHub OAuth
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth application
3. Set the callback URL: `http://localhost:3000/api/auth/callback/github`
4. Add credentials to `.env.local`

### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project and set up OAuth credentials
3. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Add credentials to `.env.local`

## 🗄️ Database

### Using SQLite (Default)
SQLite is configured by default for easy local development. The database file is created at `prisma/dev.db`.

### Switching to PostgreSQL
1. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. Update `.env.local`:
   ```bash
   DATABASE_URL="postgresql://user:password@localhost:5432/liftit"
   ```

3. Run migrations:
   ```bash
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   ```

## 🚀 Production Deployment

### Build for Production
```bash
npm run build
npm start
```

### Environment Variables for Production
Ensure these are set:
- `NEXTAUTH_URL`: Your production URL
- `NEXTAUTH_SECRET`: Strong random secret
- `DATABASE_URL`: Production database connection
- `NEXT_PUBLIC_ENABLE_DEMO_LOGIN="false"`: Disable demo login

### Recommended Platforms
- **Vercel**: Native Next.js support, easiest deployment
- **Railway**: Great for full-stack apps with databases
- **Netlify**: Good alternative with edge functions
- **Docker**: Containerized deployment for any platform

## 🎨 Design System

The application uses a modern, dark-themed design system with:
- **Primary Color**: Purple/Indigo (`hsl(263, 70%, 50%)`)
- **Accent Color**: Green (`hsl(142, 76%, 36%)`)
- **Typography**: Inter font family
- **Animations**: Smooth transitions with Framer Motion
- **Responsive**: Mobile-first approach

### Custom CSS Classes
- `.card-modern`: Enhanced card styling with hover effects
- `.border-glow`: Animated border effect
- `.gradient-text`: Gradient text for headings
- `.btn-glow`: Button with glow effect
- `.glass-effect`: Glassmorphism effect

## 🧪 Key Features Explained

### Progressive Overload Tracking
The app automatically calculates:
- **Volume**: weight × reps × sets
- **One-Rep Max**: Using Brzycki formula
- **Progress Percentage**: Compared to previous sessions

### RPE (Rate of Perceived Exertion)
Track workout intensity on a scale of 1-10:
- 7-8: Moderate difficulty
- 9: Very difficult, 1-2 reps left
- 10: Maximum effort

### Personal Records
Automatically detected for:
- Maximum weight lifted
- Maximum reps performed
- Highest volume in a session

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
- Animations by [Framer Motion](https://www.framer.com/motion/)

## 📧 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Contact the development team
- Check the documentation

---

<div align="center">
  <p>Made with ❤️ for fitness enthusiasts</p>
  <p>© 2025 Liftit V3</p>
</div>

