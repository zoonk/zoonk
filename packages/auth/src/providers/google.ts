const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_IOS_CLIENT_ID } = process.env;

export const googleProvider =
  GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: GOOGLE_IOS_CLIENT_ID
            ? [GOOGLE_CLIENT_ID, GOOGLE_IOS_CLIENT_ID]
            : GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          prompt: "select_account",
        } as const,
      }
    : {};
