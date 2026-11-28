import "server-only";
import { isLiveCallAvailable } from "@zoonk/ai/tasks/language/live-call-session";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { getCallTimeLeft } from "../../../entitlements/_utils/evaluate-usage";
import { getAllowance } from "../../../entitlements/get-allowance";
import { type PracticeCallLengths, toPracticeCallLengths } from "./call-lengths";
import { findUnitScenario } from "./conversation-scenario";

type PracticeScenarioKey = { chapterId: string; level: CefrLevel; targetRegion: string };

async function findCharacter(where: PracticeScenarioKey) {
  const scenario = await findUnitScenario(where);
  return scenario ? { name: scenario.character.name, role: scenario.character.role } : null;
}

async function loadCallLengths(): Promise<PracticeCallLengths & { paused: boolean }> {
  const allowance = await getAllowance();
  const tier = allowance?.tier ?? "guest";

  if (!allowance || tier === "guest") {
    return { ...toPracticeCallLengths({ left: null, tier }), paused: false };
  }

  const item = allowance.items.find((entry) => entry.kind === "conversation");

  if (!item) {
    throw new Error("Conversation allowance missing");
  }

  const left =
    item.availableAt && item.remaining === 0
      ? { limit: item.rollingLimit ?? 0, period: "rolling30Days" as const, seconds: 0 }
      : getCallTimeLeft({
          kind: "conversation",
          tier,
          usedLast30Days: item.usedLast30Days,
          usedToday: item.usedToday,
        });

  return {
    ...toPracticeCallLengths({ availableAt: item.availableAt, left, tier }),
    paused: !isLiveCallAvailable(),
  };
}

export async function loadPracticeCall(where: PracticeScenarioKey) {
  const [character, lengths] = await Promise.all([findCharacter(where), loadCallLengths()]);

  return { character, ...lengths };
}
