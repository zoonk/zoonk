import { type CefrLevel } from "@zoonk/utils/cefr";

export type ScenarioUnit = {
  description: string;
  id: string;
  language: string;
  objectives: string[];
  targetLanguage: string;
  title: string;
};

/** What a call needs written before it starts; `userId` comes from the capability that authorized it. */
export type CallWriting =
  | { kind: "examTask"; goalId: string; task: string; userId: string }
  | { kind: "speakingMock"; goalId: string; userId: string }
  | { kind: "speakingPaper"; mockId: string; userId: string }
  | { kind: "unitScenario"; level: CefrLevel; unit: ScenarioUnit; userId: string };

/** One run writes each key at a time, so a second ask joins it instead of writing it again. */
export function getCallWritingKey(writing: CallWriting): string {
  switch (writing.kind) {
    case "examTask":
      return `exam-task:${writing.goalId}:${writing.task}`;
    case "speakingMock":
      return `speaking-mock:${writing.goalId}`;
    case "speakingPaper":
      return `speaking-paper:${writing.mockId}`;
    case "unitScenario":
      return `scenario:${writing.unit.id}:${writing.level}`;
    default:
      return writing satisfies never;
  }
}

export type PreparingCall = { status: "preparing"; writing: CallWriting };
