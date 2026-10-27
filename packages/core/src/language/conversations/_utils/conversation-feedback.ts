import "server-only";
import { writeConversationFeedback } from "@zoonk/ai/tasks/v2/language/conversation-feedback";
import { scoreSpeaking } from "@zoonk/ai/tasks/v2/language/speaking-score";
import { type LanguageConversation } from "@zoonk/db";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { toProvenanceData } from "../../../library/_utils/library-rows";
import { type ExamTaskSnapshot } from "../../exam-speaking/speaking-contract";
import {
  getSpeakingFormat,
  getSpeakingTask,
  listTaskCriteria,
} from "../../exam-speaking/speaking-formats";
import {
  type ConversationFeedback,
  type ConversationTurn,
  type SpeakingMockExam,
  conversationFeedbackSchema,
} from "../conversation-contract";
import { getMetObjectives } from "../conversation-rules";
import { getSpeakingMockOverall, getSpeakingMockRating } from "../speaking-mock-format";
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

/** A mock's estimated bands on its exam's criteria, and the overall band the exam's way. */
async function writeMockFeedback({
  exam,
  input,
}: {
  exam: SpeakingMockExam;
  input: ReviewInput;
}): Promise<WrittenFeedback> {
  const { data, provenance } = await scoreSpeaking({
    ...getSpeakingMockRating(exam),
    analytics: { contentScope: "personal", distinctId: input.userId },
    exam,
    learnerLanguage: input.row.language,
    spokenSeconds: input.spokenSeconds,
    turns: input.turns,
  });

  const feedback = conversationFeedbackSchema.parse({
    criteria: data.criteria,
    exam,
    focus: data.focus,
    kind: "speakingMock",
    overall: getSpeakingMockOverall({ criteria: data.criteria, exam }),
  });

  return { feedback, provenance: toProvenanceData(provenance) };
}

/** An exam task's estimated bands on the criteria its paper rates it on, never a score. */
async function writeExamTaskFeedback({
  examTask,
  input,
}: {
  examTask: ExamTaskSnapshot;
  input: ReviewInput;
}): Promise<WrittenFeedback> {
  const format = getSpeakingFormat(examTask);
  const task = format ? getSpeakingTask({ format, task: examTask.task }) : null;

  if (!format || !task) {
    throw new Error(`No speaking paper for ${examTask.exam} ${examTask.level} ${examTask.task}`);
  }

  const { data, provenance } = await scoreSpeaking({
    analytics: { contentScope: "personal", distinctId: input.userId },
    criteria: listTaskCriteria({ format, task: task.key }),
    exam: format.exam,
    learnerLanguage: input.row.language,
    level: format.level,
    spokenSeconds: input.spokenSeconds,
    task: { brief: task.brief, minutes: task.minutes, name: task.name, role: task.role },
    title: format.title,
    turns: input.turns,
  });

  return { feedback: { ...data, kind: "examSpeaking" }, provenance: toProvenanceData(provenance) };
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
 * A call where the learner said nothing gets no feedback, since there's nothing to comment on. A
 * failed model call throws, so the review is tried again.
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

  return write();
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
 * went well and one thing to improve, or a speaking mock's or exam task's estimated bands by its
 * exam's criteria. A mock's score doesn't read the goals, so it's written while they're checked; a
 * call's feedback names the goals met, so it waits for them. An exam task's one goal is doing the
 * task, met once the candidate spoke in it: its grade says how well.
 */
export async function reviewConversation(
  input: ReviewInput,
): Promise<{ feedback: WrittenFeedback | null; objectivesMet: string[] }> {
  const { exam, examTask } = input.scenario;

  if (examTask) {
    const feedback = await writeFeedback({
      turns: input.turns,
      write: () => writeExamTaskFeedback({ examTask, input }),
    });

    const spoke = input.turns.some((turn) => turn.speaker === "learner");

    const objectivesMet = spoke
      ? input.scenario.objectives.map((objective) => objective.label)
      : [];

    return { feedback, objectivesMet };
  }

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
