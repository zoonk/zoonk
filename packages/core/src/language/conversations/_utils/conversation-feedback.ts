import "server-only";
import { writeConversationFeedback } from "@zoonk/ai/tasks/v2/language/conversation-feedback";
import { scoreSpeakingMock } from "@zoonk/ai/tasks/v2/language/speaking-mock-score";
import { type LanguageConversation } from "@zoonk/db";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { logError } from "@zoonk/utils/logger";
import { toProvenanceData } from "../../../library/_utils/library-rows";
import {
  type ConversationFeedback,
  type ConversationTurn,
  type SpeakingMockExam,
} from "../conversation-contract";
import { getMetObjectives } from "../conversation-rules";
import { type SavedScenario } from "./conversation-view";
import { findNewlyMetObjectives } from "./objective-check";

type ReviewInput = {
  level: CefrLevel;
  row: Pick<LanguageConversation, "goalId" | "language" | "objectivesMet" | "targetLanguage">;
  scenario: SavedScenario;
  spokenSeconds: number;
  turns: ConversationTurn[];
  userId: string;
};

export type WrittenFeedback = {
  feedback: ConversationFeedback;
  provenance: ReturnType<typeof toProvenanceData>;
};

async function writeMockFeedback({
  exam,
  input,
}: {
  exam: SpeakingMockExam;
  input: ReviewInput;
}): Promise<WrittenFeedback> {
  const { data, provenance } = await scoreSpeakingMock({
    analytics: { contentScope: "personal", distinctId: input.userId },
    exam,
    learnerLanguage: input.row.language,
    spokenSeconds: input.spokenSeconds,
    targetLanguage: input.row.targetLanguage,
    turns: input.turns,
  });

  return { feedback: { ...data, kind: "speakingMock" }, provenance: toProvenanceData(provenance) };
}

async function writeCallFeedback(
  input: ReviewInput & { objectivesMet: string[] },
): Promise<WrittenFeedback> {
  const { data, provenance } = await writeConversationFeedback({
    analytics: { contentScope: "personal", distinctId: input.userId },
    learnerLanguage: input.row.language,
    level: input.level,
    objectivesMet: input.objectivesMet,
    scenario: {
      characterName: input.scenario.character.name,
      objectives: input.scenario.objectives.map((objective) => objective.label),
      situation: input.scenario.situation,
      title: input.scenario.title,
    },
    targetLanguage: input.row.targetLanguage,
    turns: input.turns,
  });

  return { feedback: { ...data, kind: "call" }, provenance: toProvenanceData(provenance) };
}

/**
 * A call where the learner said nothing gets no feedback, since there's nothing to comment on, and
 * a failed model call leaves it empty rather than losing the call.
 */
async function writeFeedback({
  turns,
  write,
}: {
  turns: ConversationTurn[];
  write: () => Promise<WrittenFeedback>;
}): Promise<WrittenFeedback | null> {
  if (!turns.some((turn) => turn.speaker === "learner")) {
    return null;
  }

  try {
    return await write();
  } catch (error) {
    logError("Conversation feedback failed", error);
    return null;
  }
}

/** The goals marked during the call plus any the full transcript shows. */
async function findObjectivesMet(input: ReviewInput): Promise<string[]> {
  const newlyMet = await findNewlyMetObjectives(input);

  return getMetObjectives({
    labels: [...input.row.objectivesMet, ...newlyMet],
    objectives: input.scenario.objectives,
  });
}

/**
 * After a call, the goals it met and a separate text model's feedback from the transcript: what
 * went well and one thing to improve, or a speaking mock's estimated bands by its exam's criteria.
 * A mock's score doesn't read the goals, so it's written while they're checked; a call's feedback
 * names the goals met, so it waits for them.
 */
export async function reviewConversation(
  input: ReviewInput,
): Promise<{ feedback: WrittenFeedback | null; objectivesMet: string[] }> {
  const { exam } = input.scenario;

  if (exam) {
    const [objectivesMet, feedback] = await Promise.all([
      findObjectivesMet(input),
      writeFeedback({ turns: input.turns, write: () => writeMockFeedback({ exam, input }) }),
    ]);

    return { feedback, objectivesMet };
  }

  const objectivesMet = await findObjectivesMet(input);

  const feedback = await writeFeedback({
    turns: input.turns,
    write: () => writeCallFeedback({ ...input, objectivesMet }),
  });

  return { feedback, objectivesMet };
}
