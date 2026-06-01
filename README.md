# Co-Match

Co-Match is a React + Firebase application for housing matches, provider verification and AI-assisted workflows.

## Current Security Setup

- The frontend still uses Firebase Web SDK for normal user actions.
- Sensitive AI and Geoapify requests now run through Netlify Functions.
- `GEMINI_API_KEY` and `GEOAPIFY_API_KEY` are no longer intended for direct frontend usage.
- Match report reads in `firestore.rules` are tightened so only the relevant participants or admin can access them.

## Required Environment Variables

Copy `.env.example` to `.env` and fill in the missing values.

### Required secrets

- `GEMINI_API_KEY`
- `GEOAPIFY_API_KEY`
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

### Required Firebase client values

These are needed by the browser app. They are not secret in a normal Firebase web app:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_FIRESTORE_DATABASE_ID`

## Local Development

### Frontend only

```bash
npm install
npm run dev
```

This starts the Vite app on `http://localhost:3000`.

### Frontend + Netlify Functions

```bash
npx netlify dev --port 3000 --targetPort 3001
```

Use this mode if you want the secure backend functions to work locally as well.

## GitHub / Netlify Preparation

- `.env*` files are ignored by git.
- `.env.example` contains all required placeholders.
- `.eslintcache` is ignored by git.
- `.netlify/` is ignored by git.
- `netlify.toml` is included for later Netlify deployment.

## What You Still Need To Do

1. Create a real `.env` file from `.env.example`.
2. Add your Firebase Admin service account credentials.
3. Add your Gemini and Geoapify API keys.
4. In Netlify, copy the same environment variables before you deploy.
5. Review whether `firebase-applet-config.json` should remain as your client fallback config or be replaced with your preferred runtime configuration approach.
