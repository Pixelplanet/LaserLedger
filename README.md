# LaserLedger

A community-driven database of laser engraving and cutting settings. Search, share, and discover tested parameter sets for specific laser device + material + operation combinations.

Part of the [lasertools.org](https://lasertools.org) application stack.

## Overview

LaserLedger lets makers publish and discover what laser settings actually work. Users can submit tested parameters (power, speed, frequency, LPI, pulse width, passes) for specific device/material/operation combinations, with all submissions going through a moderation workflow before being published.

**Key features:**
- Browse & search community-submitted laser settings with multi-dimensional filters
- Submit settings with XCS file import for automatic parameter extraction
- Upload result photos with thumbnail generation
- Full admin CMS for managing devices, materials, laser types, and operations
- Moderator approval workflow for submissions and images
- User accounts with Google OAuth support

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 LTS |
| Backend | Express.js |
| Database | MySQL 8.4 |
| Query Builder | Knex.js |
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS 4 |
| Auth | JWT (HttpOnly cookies) + bcrypt + Google OAuth |
| Image Processing | sharp |
| Email | Nodemailer |
| Deployment | Docker + Caddy reverse proxy |

## Project Structure

```
laserledger/
├── server/          # Express.js backend
├── client/          # React + Vite frontend
├── migrations/      # Knex.js database migrations
├── seeds/           # Database seed data
├── shared/          # Shared types, schemas (server + client)
├── docs/            # Local-only design documents (gitignored)
├── .env.example     # Environment variable template
├── Dockerfile
├── docker-compose.dev.yml
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 22+
- MySQL 8.4 (or Docker)
- npm

### Setup

```bash
# Clone the repo
git clone https://github.com/pixelplanet/laserledger.git
cd laserledger

# Copy environment template
cp .env.example .env
# Edit .env with your local database credentials

# Install dependencies
npm install

# Run database migrations
npm run migrate

# Seed reference data
npm run seed

# Start development server
npm run dev
```

### Docker (alternative)

```bash
docker compose -f docker-compose.dev.yml up
```

## Deployment

Deployed at [ledger.lasertools.org](https://ledger.lasertools.org) via Docker on Hetzner, managed through Portainer.

- **CI/CD:** GitHub Actions → Docker Hub → Portainer API
- **Production deploy:** `deploy.ps1 -App laserledger -Env prod`

## License

TBD
