# StartupX AI 🚀

**Your AI Co-Founder for Market, Product, Pricing, Trust, and Growth**

A premium, production-grade SaaS platform that acts as a founder intelligence operating system. Powered by Claude (Anthropic), built with Next.js 15, Tailwind CSS, Framer Motion, Supabase, and Zod.

---

## ✨ Features

### 6 Intelligence Engines
| Engine | Purpose |
|--------|---------|
| **Idea & Market Engine** | Validate viability, score demand, uncover ICP & risks |
| **Competitor Intelligence** | Map competitors, find gaps, build a beat strategy |
| **Revenue Engine** | Pricing tiers, conversion blockers, monetization models |
| **User Psychology Engine** | Trust score, UX roast, friction points, copy fixes |
| **Growth Engine** | First 10 customers plan, channels, launch playbook |
| **Founder Decision Engine** | Priorities, confidence score, strategic brief |

### 2 Revenue Tools
- **ColdDM AI** — WhatsApp, LinkedIn, email outreach with 3 variants + follow-ups
- **BrandForge AI** — Names, taglines, positioning, brand personality, color direction

### Infrastructure
- Rate limiting (LRU cache — production: swap for Upstash Redis)
- Strict Zod input validation on all endpoints
- IP hashing for privacy
- Supabase PostgreSQL persistence
- Security headers (CSP, HSTS, X-Frame-Options)
- Premium Framer Motion animations
- Cormorant Garamond + Syne + DM Sans font system

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| AI | Anthropic Claude (claude-sonnet-4-20250514) |
| Database | Supabase (PostgreSQL) |
| Validation | Zod |
| Deployment | Vercel |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Anthropic API key
- Supabase project (optional for DB persistence)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/startupx-ai.git
cd startupx-ai
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env.local
```

Fill in your `.env.local`:

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
IP_HASH_SALT=your-random-salt-min-32-chars
```

### 3. Supabase Setup (optional but recommended)

Run this SQL in your Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS analyses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  engine_type TEXT NOT NULL,
  input_data JSONB NOT NULL DEFAULT '{}',
  output_data JSONB NOT NULL DEFAULT '{}',
  ip_hash TEXT
);

ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert analyses" ON analyses
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_analyses_session ON analyses(session_id);
CREATE INDEX idx_analyses_engine ON analyses(engine_type);
CREATE INDEX idx_analyses_created ON analyses(created_at DESC);
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📁 Project Structure

```
startupx-ai/
├── src/
│   ├── app/
│   │   ├── (marketing)/          # Public pages (Navbar + Footer)
│   │   │   ├── pricing/
│   │   │   ├── privacy/
│   │   │   └── support/
│   │   ├── (app)/                # App pages (Sidebar layout)
│   │   │   ├── dashboard/
│   │   │   ├── idea-engine/
│   │   │   ├── competitor-intelligence/
│   │   │   ├── revenue-engine/
│   │   │   ├── user-psychology/
│   │   │   ├── growth-engine/
│   │   │   ├── founder-decision/
│   │   │   ├── cold-dm/
│   │   │   └── brand-forge/
│   │   ├── api/
│   │   │   ├── analyze/          # 6 engine API routes
│   │   │   ├── generate/         # 2 generation routes
│   │   │   └── health/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx              # Landing page
│   ├── components/
│   │   ├── ui/                   # Button, ScoreRing, Badge, etc.
│   │   ├── marketing/            # Navbar, Footer, sections
│   │   ├── app/                  # Sidebar, EngineHeader, Topbar
│   │   └── shared/               # AnimatedSection
│   ├── lib/
│   │   ├── ai.ts                 # All Anthropic API calls
│   │   ├── rate-limit.ts         # LRU rate limiter
│   │   ├── supabase.ts           # DB client & operations
│   │   ├── utils.ts              # Utilities
│   │   └── validation.ts         # Zod schemas
│   └── types/
│       └── index.ts              # All TypeScript types
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── vercel.json
```

---

## 🔒 Security Architecture

- **Rate Limiting**: LRU-based per-IP (10 req/min for analysis, 15 for generation)
- **Input Validation**: Zod schemas on all API routes with length limits
- **API Keys**: Server-side only via env vars — zero client exposure
- **IP Privacy**: IPs are hashed (SHA-256 + salt) before storage
- **Security Headers**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- **Error Safety**: No stack traces exposed to clients
- **HTML Sanitization**: All user text sanitized before rendering

---

## 🚢 Deploying to Vercel

1. Push to GitHub
2. Import project in [vercel.com](https://vercel.com)
3. Add all environment variables from `.env.example`
4. Deploy

Custom domain: Set in Vercel Dashboard → Project → Domains

---

## 📦 Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npm run type-check   # TypeScript check
```

---

## 🎨 Design System

- **Fonts**: Cormorant Garamond (display), Syne (headings), DM Sans (body), JetBrains Mono (code)
- **Colors**: Cocoa brown, sage green, forest green, midnight blue, dusty peach, ivory cream
- **Motion**: Framer Motion — scroll reveals, stagger animations, 3D card hovers, parallax
- **Theme**: Premium dark with warm earth tones

---

## 📄 License

MIT License — see LICENSE file.

---

Built with ❤️ for serious founders. Ship fast, build smart.
