import "server-only";

const vercelEnv = process.env.VERCEL_ENV;
const isVercelEnv = Boolean(vercelEnv);
const isVercelPreview = isVercelEnv && vercelEnv !== "production";

/**
 * Revalidates cache tags in the main app.
 * This is used for cross-app cache invalidation when data is updated
 * in another app (e.g., editor).
 */
export async function revalidateMainApp(tags: string[]) {
  const url = `${process.env.NEXT_PUBLIC_MAIN_APP_URL}/api/revalidate`;
  const secret = process.env.REVALIDATE_SECRET;

  if (isVercelPreview) {
    console.info("Skipping revalidation in Vercel preview environment");
    return;
  }

  await fetch(url, {
    body: JSON.stringify({ tags }),
    headers: {
      "Content-Type": "application/json",
      "x-revalidate-secret": secret ?? "",
    },
    method: "POST",
  });
}
