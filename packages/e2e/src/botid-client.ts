/**
 * Stands in for `botid/client/core` in E2E builds (see `apps/main/next.config.ts`): their auth
 * doesn't check BotID, so the browser doesn't load its challenge from Vercel either.
 * @public
 */
export function initBotId() {
  // Protected requests go out without a challenge.
}
