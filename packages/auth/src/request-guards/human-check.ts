import { getEnvironment } from "@zoonk/utils/environment";
import { checkBotId } from "botid/server";

/**
 * Asks Vercel BotID whether the request came from a person, for forms that aren't Better Auth
 * endpoints (Better Auth's own requests pass `botCheckPlugin`). BotID reads the request from the
 * Vercel runtime and treats local development as human; E2E runs a production build outside
 * Vercel, so it skips the check the same way.
 */
export async function isHumanRequest(): Promise<boolean> {
  if (getEnvironment() === "e2e") {
    return true;
  }

  const { isBot } = await checkBotId();

  return !isBot;
}
