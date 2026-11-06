import { registerFollowUpStarter } from "@zoonk/core/follow-ups/starter";

/** `register()` runs this before every server's first request, the proxy's too, so the workflow loads with the first follow-up. */
export function registerFollowUpRuns(): void {
  registerFollowUpStarter(async (userId) => {
    const [{ startOnce }, { followUpsWorkflow, getFollowUpsToken }] = await Promise.all([
      import("../_shared/run-token"),
      import("./follow-ups-workflow"),
    ]);

    return startOnce(followUpsWorkflow, [{ userId }], getFollowUpsToken(userId));
  });
}
