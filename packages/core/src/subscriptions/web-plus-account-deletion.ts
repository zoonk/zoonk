import "server-only";
import { type Learner, loadCancellation } from "./_utils/load-web-plus-cancellation";
import { endSubscription, saveSubscription } from "@zoonk/auth/stop-web-plus";

export async function endWebPlusForDeletedAccount({
  learner,
}: {
  learner: Learner;
}): Promise<void> {
  const { stripeSubscription } = await loadCancellation({ learner, now: new Date() });

  if (!stripeSubscription) {
    return;
  }

  const stopped = await endSubscription(stripeSubscription);
  await saveSubscription(stopped);
}
