# KodaiRateIQ 🏨📊

> **AI-Powered Hotel Rate Intelligence Platform for Kodaikanal**

KodaiRateIQ is a production-grade hotel rate intelligence platform built for **Hotel Kodai International**. It monitors competitor pricing, generates AI-powered recommendations via Google Gemini, and presents insights through a Bloomberg-terminal inspired executive dashboard.

---

## ✨ Features

- **Real-time Rate Monitoring** — Scrapes Booking.com, Goibibo, MakeMyTrip
- **AI-Powered Recommendations** — Google Gemini generates pricing strategies
- **Stock-Market Style Dashboard** — Price movements with Bloomberg-inspired UI
- **30-Day Price History Charts** — Interactive Recharts area charts
- **4 Pricing Strategies** — Aggressive, Balanced, Conservative, Premium
- **Facility Comparison Matrix** — Side-by-side amenity comparison
- **Automated Daily Scraping** — 3x daily via cron

## 🏨 Hotels Tracked

| Hotel | Stars | Role |
|-------|-------|------|
| The Tamara Kodai | ★★★★★ | Ultra-Premium Anchor |
| The Carlton | ★★★★★ | Premium Anchor |
| Sterling Kodai Lake | ★★★★ | Direct Competitor |
| Le Poshe by Sparsa | ★★★ | Direct Competitor |
| **Hotel Kodai International** | ★★★ | **Target Hotel** |

## 🚀 Quick Start

```bash
# Install
npm install

# Configure
cp .env.example .env
# Edit .env with DATABASE_URL and GEMINI_API_KEY

# Database
npx prisma db push
npx tsx prisma/seed.ts

# Run
npm run dev
```

## 📡 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/rates/live` | Current rates for all hotels |
| `GET /api/rates/history?days=30` | Historical chart data |
| `GET /api/recommendation` | AI pricing recommendation |
| `GET /api/competitors` | Hotel profiles |
| `GET /api/facilities` | Facility comparison |
| `GET /api/insights` | AI market insights |
| `GET /api/cron?secret=XXX` | Trigger scrape cycle |

## 🏗️ Tech Stack

Next.js 16 • TypeScript • Tailwind CSS v4 • PostgreSQL • Prisma • Recharts • Playwright • Google Gemini AI

## 📄 License

Private — Built for Hotel Kodai International
