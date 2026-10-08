import "server-only";
import { prisma } from "@zoonk/db";
import { getEntitlementViewer } from "../../../entitlements/_utils/entitlement-viewer";
import { getCallTimeLeft } from "../../../entitlements/_utils/evaluate-usage";
import { sumCallSeconds } from "../../../entitlements/_utils/usage-counts";
import { conversationScenarioSchema } from "../conversation-contract";
import { type PracticeCallLengths, toPracticeCallLengths } from "./call-lengths";

/** Who the learner talks to in the unit's call, once a call at their level was written. */
async function findCharacter({ chapterId, level }: { chapterId: string; level: string }) {
  const saved = await prisma.conversationScenario.findUnique({
    select: { content: true },
    where: { chapterLevel: { chapterId, level } },
  });

  const scenario = conversationScenarioSchema.safeParse(saved?.content);

  return scenario.success
    ? { name: scenario.data.character.name, role: scenario.data.character.role }
    : null;
}

/** The lengths the signed-in learner can pick now, from their plan and the call time they used. */
async function loadCallLengths(): Promise<PracticeCallLengths> {
  const viewer = await getEntitlementViewer();
  const tier = viewer?.tier ?? "guest";

  if (!viewer || tier === "guest") {
    return toPracticeCallLengths({ left: null, tier });
  }

  const used = await sumCallSeconds({ client: prisma, now: new Date(), userId: viewer.userId });

  const left = getCallTimeLeft({
    kind: "conversation",
    tier,
    usedThisMonth: used.thisMonth,
    usedToday: used.today,
  });

  return toPracticeCallLengths({ left, tier });
}

/**
 * A unit's practice call as it's offered to the signed-in learner, on the unit's page or by the
 * buddy: who they talk to (once a call at their speaking level was written) and the lengths they
 * can pick now (`toPracticeCallLengths`).
 */
export async function loadPracticeCall({ chapterId, level }: { chapterId: string; level: string }) {
  const [character, lengths] = await Promise.all([
    findCharacter({ chapterId, level }),
    loadCallLengths(),
  ]);

  return { character, ...lengths };
}
