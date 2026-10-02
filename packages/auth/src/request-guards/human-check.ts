import { getBotIdVerification } from "./bot-id";

/**
 * Asks Vercel BotID whether the request came from a person, for forms that aren't Better Auth
 * endpoints (Better Auth's own requests pass `botCheckPlugin`). Both accept local development
 * and E2E without BotID proof while deployed previews and production verify it.
 */
export async function isHumanRequest(): Promise<boolean> {
  const { isBot } = await getBotIdVerification();

  return !isBot;
}
