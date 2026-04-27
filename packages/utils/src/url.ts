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
