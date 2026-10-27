import "server-only";
import { prisma } from "@zoonk/db";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { getEntitlementViewer } from "../../../entitlements/_utils/entitlement-viewer";
import { getCallTimeLeft } from "../../../entitlements/_utils/evaluate-usage";
import { sumCallSeconds } from "../../../entitlements/_utils/usage-counts";
import { type PracticeCallLengths, toPracticeCallLengths } from "./call-lengths";
import { findUnitScenario } from "./conversation-scenario";
import { readLiveCallAdmission } from "./live-call-policy";

/** Who the learner talks to in the unit's call, once a call at their level was written. */
async function findCharacter(where: { chapterId: string; level: CefrLevel }) {
  const scenario = await findUnitScenario(where);
  return scenario ? { name: scenario.character.name, role: scenario.character.role } : null;
}

/** The lengths the signed-in learner can pick now, from their plan and the call time they used. */
async function loadCallLengths(): Promise<PracticeCallLengths & { paused: boolean }> {
  const viewer = await getEntitlementViewer();
  const tier = viewer?.tier ?? "guest";

  if (!viewer || tier === "guest") {
    return { ...toPracticeCallLengths({ left: null, tier }), paused: false };
  }

  const [used, admission] = await Promise.all([
    sumCallSeconds({ client: prisma, now: new Date(), userId: viewer.userId }),
    readLiveCallAdmission({ transaction: prisma, userId: viewer.userId }),
  ]);

  const left = getCallTimeLeft({
    kind: "conversation",
    tier,
    usedThisMonth: used.thisMonth,
    usedToday: used.today,
  });

  return { ...toPracticeCallLengths({ left, tier }), paused: admission === null };
}

/**
 * A unit's practice call as it's offered to the signed-in learner, on the unit's page or by the
 * buddy: who they talk to (once a call at their speaking level was written) and the lengths they
 * can pick now (`toPracticeCallLengths`).
 */
export async function loadPracticeCall({
  chapterId,
  level,
}: {
  chapterId: string;
  level: CefrLevel;
}) {
  const [character, lengths] = await Promise.all([
    findCharacter({ chapterId, level }),
    loadCallLengths(),
  ]);

  return { character, ...lengths };
}
