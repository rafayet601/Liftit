# Liftit — AI-Powered Fitness Tracker

An intelligent fitness tracking app (web + iOS via Capacitor) that helps users track workouts and receive personalized guidance through an AI trainer powered by Claude. Features progressive overload algorithms, weekly program generation, and data-driven workout recommendations, wrapped in a world-class lime-on-black UI.

## What's new in v3.0

- **Full visual redesign** — editorial typography, layered surfaces, refined motion. Lime (`#bef264`) on ink-black, elevated with tokens in `src/index.css`.
- **iOS-ready** — Capacitor wrapper with haptics, safe-area aware layouts, status-bar + keyboard handling (`src/lib/platform.js`).
- **Installable PWA** — `vite-plugin-pwa`, manifest, service worker with runtime caching.
- **Strict tooling** — ESLint 9 flat config (`eslint.config.js`) running with `--max-warnings 0`.
- **Smoke test harness** — Vitest + Testing Library (`src/test/`) wired to `npm test`.
- **SPA navigation** — 401 interceptor emits `liftit:auth-expired` and soft-redirects; Settings uses `navigate()` instead of reloads.

## Features

- **AI Trainer**: Natural-language chat with a Claude-powered coach
- **Progressive Overload**: Weight/rep recommendations informed by RPE and performance
- **Program Generation**: AI-generated, personalized workout programs
- **Workout Tracking**: Log sets, reps, weight, RPE — with inline haptics
- **Progress Analytics**: Visualize strength gains, weekly volume, and muscle balance
- **Offline Support**: LocalStorage fallback when the API is unreachable
- **OAuth Authentication**: Secure login with Google or GitHub
- **iOS + PWA**: Installable on home screen; near-native feel via Capacitor

## Tech Stack

### Frontend
- React 18 + Vite
- React Router DOM
- Tailwind CSS (design tokens in `src/index.css`)
- Recharts (analytics)
- Axios (API client)
- Capacitor (iOS wrapper)
- vite-plugin-pwa (service worker + manifest)
- Vitest + @testing-library/react (smoke tests)
- ESLint 9 (flat config)

### Backend
- Express.js + TypeScript
- Prisma ORM
- MySQL Database
- MCP SDK (Model Context Protocol)
- Anthropic Claude API

## Project Structure

```
liftit/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── ai/            # AI trainer components
│   │   ├── auth/          # Authentication components
│   │   └── ui/            # Reusable UI components
│   ├── contexts/          # React contexts
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Utilities & localStorage
│   ├── pages/             # Page components
│   └── services/          # API services
├── server/                 # Express backend
│   ├── prisma/            # Database schema & seed
│   │   └── schema.prisma  # Database models
│   └── src/
│       ├── ai/            # AI trainer & Claude integration
│       ├── config/        # Configuration
│       ├── middleware/    # Express middleware
│       ├── mcp/           # MCP server & tools
│       ├── routes/        # API routes
│       └── services/      # Business logic
├── docker-compose.yml      # Docker setup
├── Dockerfile              # Container build
└── azure.bicep            # Azure deployment
```

## Quick Start

### Prerequisites
- Node.js 20+
- MySQL 8.0+ (or Docker)
- Anthropic API key
- Google OAuth credentials (optional)
- GitHub OAuth credentials (optional)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/liftit.git
cd liftit
npm install
cd server && npm install && cd ..
```

### 2. Configure Environment

```bash
# Backend
cp server/.env.example server/.env
# Edit server/.env with your credentials

# Frontend
cp .env.example .env
```

**Required Environment Variables:**

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MySQL connection string |
| `JWT_SECRET` | Secret for JWT tokens |
| `ANTHROPIC_API_KEY` | API key for Claude |
| `GOOGLE_CLIENT_ID` | Google OAuth app ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |
| `GITHUB_CLIENT_ID` | GitHub OAuth app ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth secret |

### 3. Setup Database

```bash
# Create MySQL database
mysql -u root -p -e "CREATE DATABASE liftit;"

# Push schema to database
npm run db:push

# Seed exercise data
npm run db:seed

# Open Prisma Studio (optional)
npm run db:studio
```

### 4. Run Development Servers

```bash
# Run both frontend and backend
npm run dev:all

# Or run separately:
npm run dev        # Frontend on http://localhost:5173
npm run server     # Backend on http://localhost:3001
```

## Quality & Testing

```bash
npm run lint        # ESLint 9 flat config, 0 warnings allowed
npm test            # Vitest smoke tests (single run)
npm run test:watch  # Vitest in watch mode
npm run build       # Production build (Vite + PWA)
npm run check       # lint + test + build, all in one shot
```

Smoke tests live under `src/test/` and cover LoginPage render, the UnitContext API shape, and kg ↔ lbs rounding. Add new specs as `src/**/*.test.jsx`.

## iOS Build (Capacitor)

The web app runs as a PWA out of the box. For a native iOS wrapper:

```bash
# One-time: create the Xcode project (requires Xcode on macOS)
npm run ios:init

# Build web assets and sync them into the iOS project
npm run ios:sync

# Open in Xcode to run on a simulator or device
npm run ios:open
```

Capacitor plugins wired: `@capacitor/status-bar`, `@capacitor/keyboard`, `@capacitor/haptics`, `@capacitor/splash-screen`. Native shell initialization happens lazily in `src/lib/platform.js` (no-ops on web). App metadata is in `capacitor.config.json` (`appId: com.liftit.app`).

### iOS-specific UX polish

- `viewport-fit=cover` + `safe-top` / `safe-bottom` utility classes
- 16px minimum font-size on inputs to prevent iOS zoom
- Bottom tab bar (`MobileNav`) respects the home-indicator inset
- Haptics: `hapticLight` / `Medium` / `Success` / `Selection` with `navigator.vibrate` fallback on web

## Docker Setup

### Using Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Azure Deployment

1. Create Azure resources:
```bash
az deployment group create \
  --resource-group liftit-rg \
  --template-file azure.bicep \
  --parameters jwtSecret=$JWT_SECRET anthropicApiKey=$ANTHROPIC_API_KEY
```

2. Configure OAuth apps:
   - Google: [Google Cloud Console](https://console.cloud.google.com)
   - GitHub: [GitHub Developer Settings](https://github.com/settings/developers)

3. Set environment variables in Azure App Service

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/google` | Google OAuth login |
| GET | `/api/auth/google/callback` | OAuth callback |
| GET | `/api/auth/github` | GitHub OAuth login |
| GET | `/api/auth/github/callback` | OAuth callback |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/profile` | Get user profile |
| PUT | `/api/users/profile` | Update profile |
| GET | `/api/users/preferences` | Get preferences |

### Workouts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workouts` | List workouts |
| POST | `/api/workouts` | Create workout |
| GET | `/api/workouts/:id` | Get workout |
| PUT | `/api/workouts/:id` | Update workout |
| DELETE | `/api/workouts/:id` | Delete workout |

### Exercises
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/exercises` | List exercises |
| GET | `/api/exercises/:id` | Get exercise |
| GET | `/api/exercises/muscle/:group` | Filter by muscle |

### Programs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/programs` | List programs |
| POST | `/api/programs` | Create program |
| GET | `/api/programs/:id` | Get program |
| PUT | `/api/programs/:id` | Update program |
| GET | `/api/programs/current` | Active program |

### AI Trainer
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/chat` | Chat with AI trainer |
| POST | `/api/ai/generate-program` | Generate program |
| POST | `/api/ai/adjust-program` | Adjust weekly program |
| GET | `/api/ai/progression/:exerciseId` | Progression recommendation |
| POST | `/api/ai/analyze` | Analyze performance |

### MCP Server
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/mcp` | MCP HTTP endpoint |
| GET | `/api/mcp/sse` | MCP SSE endpoint |

## Progressive Overload Algorithm

The AI trainer uses evidence-based progressive overload principles:

### 1RM Estimation
```javascript
estimated1RM = weight × (1 + reps/30)  // Epley formula
```

### Weekly Progression Rates
- **Beginner**: 2.5-5% per week
- **Intermediate**: 1-2.5% per week
- **Advanced**: 0.5-1% per week (or block periodization)

### RPE-Based Auto-Regulation
| RPE | Action |
|-----|--------|
| < 7 | Increase weight by 2.5-5% |
| 7-8 | Maintain weight, aim for +1 rep |
| 8-9 | Maintain weight and reps |
| > 9 | Reduce weight by 5-10% (deload) |

### Volume Landmarks (per muscle group/week)
- **Maintenance**: 6-10 sets
- **Hypertrophy**: 12-20 sets
- **High Volume**: 20-30 sets

## OAuth Setup

### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3001/api/auth/google/callback`

### GitHub OAuth
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. New OAuth App
3. Set homepage URL and callback URL
4. Generate client secret

## License

MIT
