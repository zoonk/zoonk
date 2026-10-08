function getDefaultApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:4000";
  }

  if (process.env.VERCEL_ENV !== "production") {
    return "https://api.zoonk.dev";
  }

  return "https://api.zoonk.com";
}

export const API_URL = getDefaultApiUrl();
export const BLOG_URL = "https://blog.zoonk.com";
export const SITE_URL = "https://www.zoonk.com";

/**
 * The main web app, where a sign-in that started on the API itself (no app asked for it) ends.
 * Server-only: read at runtime, so development and E2E point it at their own main app.
 */
function getDefaultMainUrl(): string {
  if (process.env.MAIN_APP_URL) {
    return process.env.MAIN_APP_URL;
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  return SITE_URL;
}

export const MAIN_URL = getDefaultMainUrl();
