# Financify

A single-user personal finance app: a native iOS app (`mobile/`, Expo / React Native, styled after Rocket Money with a blue theme) backed by a Next.js API on Vercel, Plaid and Neon PostgreSQL.

## Stack

- **iOS app:** Expo 57 / React Native, expo-router (`mobile/`)
- **API:** Next.js route handlers (App Router, TypeScript); the JSON contract is `src/contracts/mobile-api.ts`
- **Database:** Neon serverless PostgreSQL via Drizzle ORM
- **Banking data:** Plaid (Hosted Link, transactions sync, recurring streams)
- **Auth:** single user; `POST /api/mobile/login` checks the Argon2 password hash and returns a 90-day bearer token

## Backend

Copy `.env.example` to `.env.local` and fill in values, then:

```bash
npm run dev
```

## iOS app

```bash
cd mobile && npm install
npx expo run:ios                       # simulator, API from EXPO_PUBLIC_API_URL
../scripts/build-sideload-ipa.sh       # unsigned .ipa for SideStore/AltStore
```

The sideload build points at `https://financify-one.vercel.app` unless `API_URL` is set.
