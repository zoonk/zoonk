import { type StudySessionBlock, prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { listeningSetFixture } from "@zoonk/testing/fixtures/listening";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { runDeferredWork } from "../../../_test-utils/deferred-work";
import { toListeningExam } from "../../../exams/listening/listening-exam";
import { getListeningSkillIds } from "../../../exams/listening/listening-skills";
import { recordLearnerAnswer } from "../../../learner/record-learner-answer";
import {
  type ExamChoiceFormat,
  getExamChoiceFormat,
} from "../../../library/exams/exam-choice-format";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { answerStudyQuestion } from "../../../sessions/answer-study-question";
import { getBlockItemIds, readBlockPayload } from "../../../sessions/block-payload";
import { finishStudyBlock } from "../../../sessions/finish-study-block";
import { startStudyBlock } from "../../../sessions/start-study-block";
import { type RuleAnswer, type RuleContext } from "../rules/rule-context";
import { getPlacementAnswerTime } from "./sim-claims";
import { SIM_ANSWER_MS, toRuleFormat, toSimAnswer, toSimItem } from "./sim-db-items";
import { SIM_PROVENANCE, type SimLibrary } from "./sim-library";

/**
 * The question bank the database tier's lives answer: the fixtures carry no questions, so each
 * skill gets a few in the exam's choice format (see `toSimItem`), and a skill the exam practices
 * only with its recordings also gets voiced recordings with questions of their own. With
 * them, sessions hold placement questions, reviews, practice and duels, and the learner's answers
 * reach the learner model as a real session's do. A listening skill keeps its text questions too,
 * as a skill another goal shares would: only recordings may ask it (R37).
 */
const QUESTIONS_PER_SKILL = 4;
const RECORDINGS_PER_SKILL = 2;
const QUESTIONS_PER_RECORDING = 3;
const RECORDING_MS = 40_000;

/** A field no goal studies: questions in it are placement's own, which no session asks again. */
const PLACEMENT_ONLY_FIELD = "sim-placement";

/**
 * Placement's answers, one moment apart in the order given and just before `at`, on questions of
 * their own in the exam's choice format that sessions never ask. With `memory` (a life with a
 * question bank) they're recorded as `answerPlacementQuestion` records them: diagnostic answers, a
 * right one starting the skill's memory, so it comes back in a review. Without it they're only the
 * attempts the learner model reads a test's claims from (`loadSkillClaims`): no answer of such a
 * life writes memory, a lesson's included, as the pure tier models it.
 */
export async function recordPlacementAnswers({
  answers,
  at,
  choice,
  language,
  memory,
  userId,
}: {
  answers: readonly (readonly [skillId: string, correct: boolean])[];
  at: Date;
  choice: ExamChoiceFormat | null;
  language: string;
  memory: boolean;
  userId: string;
}): Promise<void> {
  const asked = await Promise.all(
    answers.map(async ([skillId, correct]) => ({
      correct,
      item: await itemFixture({
        ...toSimItem({ choice, question: "Placement question?" }),
        field: PLACEMENT_ONLY_FIELD,
        language,
        skillId,
      }),
    })),
  );

  // Placement asks one question after the other, so each answer reads the memory the one before
  // left.
  await asked.reduce(async (previous, { correct, item }, index) => {
    await previous;

    const answer = toSimAnswer({ correct, format: item.format });
    const answeredAt = getPlacementAnswerTime({ at, count: answers.length, index });

    if (!memory) {
      await attemptFixture({
        answer,
        answeredAt,
        isCorrect: correct,
        isPlacement: true,
        itemId: item.id,
        skillId: item.skillId,
        userId,
      });

      return;
    }

    await recordLearnerAnswer({
      answer,
      answeredAt,
      graded: { durationMs: SIM_ANSWER_MS, isCorrect: correct },
      isPlacement: true,
      itemId: item.id,
      language,
      purpose: "diagnostic",
      skillId: item.skillId,
      timeZone: "UTC",
      userId,
    });
  }, Promise.resolve());
}

/**
 * What the copy's exam asks: its choice format, and the skills it practices only with recordings
 * (`getListeningSkillIds`).
 */
export async function loadCopyExam(library: SimLibrary) {
  const examBlueprint = library.blueprintId
    ? await prisma.examBlueprint.findUnique({ where: { id: library.blueprintId } })
    : null;

  return {
    choice: examBlueprint
      ? getExamChoiceFormat(readBlueprintContent(examBlueprint).structure)
      : null,
    listening: getListeningSkillIds({
      exam: toListeningExam({ examBlueprint, ...library.fixture.goal }),
      graph: library.graph,
    }),
  };
}

/** A voiced recording of the exam's, with its questions on one listening skill. */
async function seedRecording({
  choice,
  library,
  skillId,
}: {
  choice: ExamChoiceFormat | null;
  library: SimLibrary;
  skillId: string;
}) {
  const { language } = library.fixture.goal;
  const audio = await mediaAssetFixture({ durationMs: RECORDING_MS, kind: "audio" });

  const recording = await listeningSetFixture({
    examBlueprintId: library.blueprintId,
    language,
    mediaAssetId: audio.id,
    ...SIM_PROVENANCE,
  });

  await prisma.item.createMany({
    data: Array.from({ length: QUESTIONS_PER_RECORDING }, (_, setPosition) => ({
      ...toSimItem({ choice, question: `What was said (${setPosition + 1})?` }),
      language,
      setId: recording.id,
      setPosition,
      skillId,
      ...SIM_PROVENANCE,
    })),
  });
}

/** Each skill of a life's library copy gets its questions, and each listening skill recordings. */
export async function seedSimQuestions(library: SimLibrary): Promise<void> {
  const { fixture } = library;
  const { choice, listening } = await loadCopyExam(library);

  await Promise.all(
    [...listening].flatMap((skillId) =>
      Array.from({ length: RECORDINGS_PER_SKILL }, () =>
        seedRecording({ choice, library, skillId }),
      ),
    ),
  );

  await prisma.item.createMany({
    data: library.graph.skills.flatMap((skill) =>
      Array.from({ length: QUESTIONS_PER_SKILL }, (_, index) => ({
        ...toSimItem({ choice, question: `${skill.name} (${index + 1})?` }),
        language: fixture.goal.language,
        skillId: skill.skillId,
        ...SIM_PROVENANCE,
      })),
    ),
  });
}

/** Where an answer counts, by the block that asked it. */
function toAnswerSource({
  block,
  itemId,
  placementItemIds,
}: {
  block: Pick<StudySessionBlock, "kind">;
  itemId: string;
  placementItemIds: readonly string[];
}): RuleAnswer["source"] {
  if (placementItemIds.includes(itemId)) {
    return "placement";
  }

  return block.kind === "practice" ? "practice" : "review";
}

/**
 * Plays a question block as the player does: each question in order, wrong on the skills the
 * learner misses that day and right on the others. Returns the answers as the checks read them.
 */
export async function playQuestionBlock({
  at,
  block,
  misses,
  sessionId,
}: {
  at: Date;
  block: Pick<StudySessionBlock, "id" | "kind" | "payload">;
  misses: ReadonlySet<string>;
  sessionId: string;
}): Promise<RuleAnswer[]> {
  const payload = readBlockPayload(block);
  const itemIds = getBlockItemIds(payload);
  const input = { timeZone: "UTC" };

  await startStudyBlock({ blockId: block.id, input, sessionId });

  const items = await prisma.item.findMany({
    select: { format: true, id: true, set: { select: { kind: true } }, skillId: true },
    where: { id: { in: itemIds } },
  });

  const byId = new Map(items.map((item) => [item.id, item]));
  const recorded = new Set(items.flatMap((item) => (item.set?.kind === "audio" ? [item.id] : [])));

  // The player asks one question after the other.
  const answers = await itemIds.reduce<Promise<RuleAnswer[]>>(async (previous, itemId) => {
    const answered = await previous;
    const item = byId.get(itemId);
    const skillId = item?.skillId ?? "";
    const format = item?.format ?? "multipleChoice";
    const correct = !misses.has(skillId);

    // What an answer leaves for after its response (a placement answer's re-plan) is done before
    // the next one, as the learner reads the feedback.
    const finish = runDeferredWork();

    const result = await answerStudyQuestion({
      blockId: block.id,
      input: { answer: toSimAnswer({ correct, format }), durationMs: SIM_ANSWER_MS, itemId },
      sessionId,
    });

    await finish();

    if (result.status !== "ready") {
      return answered;
    }

    const source = toAnswerSource({ block, itemId, placementItemIds: payload.placementItemIds });

    return [
      ...answered,
      {
        at,
        correct: result.feedback.isCorrect,
        format: toRuleFormat(format),
        ...(recorded.has(itemId) && { recording: true }),
        skillId,
        source,
      },
    ];
  }, Promise.resolve([]));

  const finish = runDeferredWork();
  await finishStudyBlock({ blockId: block.id, input, sessionId });
  await finish();
  return answers;
}

/** Every study session of the goal so far, oldest first, with the skills its questions asked. */
export async function readSimSessions(goalId: string): Promise<RuleContext["sessions"]> {
  const sessions = await prisma.studySession.findMany({
    include: { blocks: { orderBy: { position: "asc" } } },
    orderBy: { localDate: "asc" },
    where: { goalId },
  });

  return sessions.map((session) => ({
    day: session.localDate,
    practiceSkillIds: [
      ...new Set(
        session.blocks.flatMap((block) =>
          block.kind === "practice" || block.kind === "review"
            ? readBlockPayload(block).skillIds
            : [],
        ),
      ),
    ],
  }));
}
