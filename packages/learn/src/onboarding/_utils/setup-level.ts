import { type OnboardingOwnLevel } from "@zoonk/core/view-models/onboarding/contract";
import { parseCefrScore } from "@zoonk/utils/cefr";

const OWN_LEVELS: readonly OnboardingOwnLevel[] = ["advanced", "basic", "intermediate", "none"];

export type SetupLevel =
  | { kind: "own"; level: OnboardingOwnLevel }
  | { kind: "tested" | "words"; text: string };

export function readOwnLevel(details: Record<string, unknown>): OnboardingOwnLevel | null {
  return OWN_LEVELS.find((level) => level === details.level) ?? null;
}

function hasAnsweredLevel(details: Record<string, unknown>): boolean {
  return Array.isArray(details.answered) && details.answered.includes("level");
}

/** A level test's result, then the level the learner picked, then the level their words gave. */
export function readSetupLevel(details: Record<string, unknown>): SetupLevel | null {
  const { level, levelNote } = details;
  const own = readOwnLevel(details);

  if (typeof level === "string" && parseCefrScore(level) !== null) {
    return { kind: "tested", text: level };
  }

  if (own && hasAnsweredLevel(details)) {
    return { kind: "own", level: own };
  }

  if (typeof levelNote === "string" && levelNote.trim() !== "") {
    return { kind: "words", text: levelNote };
  }

  return own ? { kind: "own", level: own } : null;
}
