# Zoonk Auth

Centralized authentication app for Zoonk at `auth.zoonk.com`.

## Purpose

This app handles all authentication flows (login, signup, social auth) for the Zoonk ecosystem. It centralizes authentication logic so that:

1. All apps share a consistent authentication UX
2. OAuth providers only need to be configured once
3. Multi-tenant apps with custom domains can authenticate through a single trusted domain

## How it works

1. When a user clicks "Login" on any Zoonk app (main, editor, admin), they are redirected to `auth.zoonk.com/login?redirectTo=<app_callback_url>`
2. The user authenticates using email OTP or social login (Google/Apple)
3. After successful authentication, a One-Time Token (OTT) is generated
4. The user is redirected back to the original app with the OTT: `<app_callback_url>?token=<ott>`
5. The original app verifies the OTT and creates a session cookie

## Environment Variables

See `.env.example` for required environment variables.

## Development

This app runs on port 3004 by default:

```bash
pnpm dev
```
