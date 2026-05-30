# Stack Decay Score

Track and score the health of your project dependencies — maintenance activity, community strength, known vulnerabilities, end-of-life risk, and license compliance — all in one dashboard.

![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)

## What It Does

Connect your GitHub repos and get a health score (0–100) for every dependency based on five dimensions:

- **Security (30%)** — checks OSV and GitHub Advisory databases for known CVEs
- **Maintenance (25%)** — release frequency, commit activity, issue responsiveness
- **End-of-Life (20%)** — deprecated packages, archived repos, sunset timelines
- **Community (15%)** — stars, forks, contributors, download trends, adoption
- **Licensing (10%)** — SPDX classification and copyleft risk assessment

Each repo gets an aggregate grade (A through F) with concentration risk penalties when multiple dependencies have issues.

## Features

- **Multi-repo dashboard** with trend charts and grade distribution
- **Dependency tree visualization** grouped by manifest file
- **Vulnerability tracking** with severity breakdown and fix suggestions
- **EOL timeline** showing upcoming deprecation dates
- **Health heatmap** for spotting problem areas at a glance
- **License compliance panel** with risk tiers
- **Package comparison** — side-by-side analysis of alternatives
- **Team overview** — aggregate metrics across all your repos
- **Export reports** as PDF, CSV, or plain text
- **GitHub webhooks** — auto-scan on push to default branch
- **Weekly email digests** with score changes and new vulnerabilities
- **Alert rules** — get notified when scores drop or new CVEs appear
- **Global search** across packages and repositories
- **Dark mode**

## Tech Stack

**Monorepo** managed with pnpm workspaces + Turborepo

| Package | Stack |
|---------|-------|
| `packages/server` | Express, Mongoose, BullMQ, pdfkit, Zod, Pino |
| `packages/client` | React, React Router, TanStack Query, Zustand, Recharts, Tailwind CSS |
| `packages/shared` | Shared TypeScript types and constants |

**Data sources:** npm registry, PyPI, RubyGems, crates.io, OSV.dev, GitHub Advisory API, GitHub REST API, Libraries.io

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- MongoDB (local or Atlas)
- Redis (local or Upstash)
- GitHub OAuth app ([create one here](https://github.com/settings/developers))

### Setup

```bash
# Clone the repo
git clone https://github.com/iamsurajchahar/stack-decay.git
cd stack-decay

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your values (see Environment Variables below)

# Run in development
pnpm dev
```

The client runs on `http://localhost:3000` and the API on `http://localhost:4000`.

### Using Docker

```bash
cd docker
docker compose up --build
```

This starts MongoDB, Redis, the API server, a background worker (2 replicas), and the client.

## Environment Variables

Create a `.env` file in the project root:

```env
# GitHub OAuth
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_CALLBACK_URL=http://localhost:4000/api/auth/github/callback

# Auth
JWT_SECRET=your_random_secret_min_16_chars
JWT_EXPIRES_IN=7d

# Database
MONGODB_URI=mongodb://localhost:27017/stack-decay-score

# Cache
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Encryption (for storing GitHub tokens)
ENCRYPTION_KEY=your_random_hex_min_16_chars

# Optional: enrichment APIs
LIBRARIES_IO_API_KEY=
NVD_API_KEY=

# Optional: notifications
SENDGRID_API_KEY=
SLACK_WEBHOOK_URL=

# App
NODE_ENV=development
PORT=4000
CLIENT_URL=http://localhost:3000
LOG_LEVEL=info
```

## Project Structure

```
stack-decay/
├── packages/
│   ├── client/          # React frontend
│   │   └── src/
│   │       ├── api/          # API client functions
│   │       ├── components/   # UI components by feature
│   │       ├── hooks/        # Custom React hooks
│   │       └── store/        # Zustand stores
│   ├── server/          # Express backend
│   │   └── src/
│   │       ├── config/       # Environment and Redis config
│   │       ├── controllers/  # Route handlers
│   │       ├── middleware/   # Auth, rate limiting, validation
│   │       ├── models/       # Mongoose schemas
│   │       ├── routes/       # Express router definitions
│   │       └── services/
│   │           ├── enrichment/  # npm, PyPI, OSV, GitHub API clients
│   │           ├── scanner/     # Manifest detection and parsing
│   │           └── scoring/     # Health score calculation
│   └── shared/          # Shared types and constants
└── docker/              # Docker and compose files
```

## How Scoring Works

1. **Scan** — detect manifest files (package.json, requirements.txt, Gemfile, Cargo.toml, etc.) and parse dependencies
2. **Enrich** — fetch metadata from package registries, vulnerability databases, and GitHub
3. **Score** — compute per-dependency scores across 5 dimensions using weighted formulas
4. **Aggregate** — roll up into a repo-level score with type-based weighting (direct deps: 1.0, dev: 0.5, transitive: 0.3) and concentration risk penalties

Grade thresholds: **A** (80+) · **B** (65–79) · **C** (50–64) · **D** (35–49) · **F** (below 35)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/github` | Start GitHub OAuth flow |
| `GET` | `/api/repos` | List connected repositories |
| `POST` | `/api/repos` | Add a repository |
| `GET` | `/api/repos/:id` | Repository details |
| `POST` | `/api/repos/:id/scans` | Trigger a new scan |
| `GET` | `/api/repos/:id/scans/latest` | Latest scan results |
| `GET` | `/api/repos/:id/scores` | Score snapshot history |
| `GET` | `/api/repos/:id/vulnerabilities` | Vulnerability list |
| `GET` | `/api/repos/:id/licenses` | License breakdown |
| `GET` | `/api/repos/:id/eol` | EOL/deprecation timeline |
| `GET` | `/api/repos/:id/dependency-tree` | Full dependency tree |
| `GET` | `/api/repos/:id/recommendations` | Actionable recommendations |
| `GET` | `/api/repos/:id/export/pdf` | Download PDF report |
| `GET` | `/api/repos/:id/export/dependencies` | Export dependencies CSV |
| `GET` | `/api/repos/:id/export/vulnerabilities` | Export vulnerabilities CSV |
| `GET` | `/api/packages/compare` | Compare packages side by side |
| `GET` | `/api/team/overview` | Team-wide dashboard data |
| `GET` | `/api/search` | Global search |
| `POST` | `/api/webhooks/github` | GitHub push webhook |

## License

MIT
