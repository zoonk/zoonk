const clientId = process.env.GOOGLE_CLIENT_ID as string;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET as string;

function isGoogleEnabled() {
  return Boolean(clientId) && Boolean(clientSecret);
}

export const googleProvider = isGoogleEnabled()
  ? { google: { clientId, clientSecret, prompt: "select_account" } as const }
  : {};
