# Financify

A single-user personal finance PWA built with Next.js, Plaid, and Neon (PostgreSQL).

## Stack

- **Framework:** Next.js (App Router, TypeScript)
- **Database:** Neon serverless PostgreSQL via Drizzle ORM
- **Banking data:** Plaid API
- **Auth:** Auth.js v5 (next-auth@beta) with Argon2 password hashing
- **PWA:** Serwist (service worker)
- **Styling:** Tailwind CSS v4

## Getting Started

Copy `.env.example` to `.env.local` and fill in values, then:

```bash
npm run dev
```
