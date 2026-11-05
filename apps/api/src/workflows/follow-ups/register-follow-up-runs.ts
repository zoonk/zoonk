import { registerFollowUpStarter } from "@zoonk/core/follow-ups/starter";

/** `register()` runs this before every server's first request, the proxy's too, so the workflow loads with the first follow-up. */
export function registerFollowUpRuns(): void {
  registerFollowUpStarter(async (userId) => {
    const [{ start }, { followUpsWorkflow }] = await Promise.all([
      import("workflow/api"),
      import("./follow-ups-workflow"),
    ]);

    return start(followUpsWorkflow, [{ userId }]);
  });
}
