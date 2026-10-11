import { prisma } from "@zoonk/db";
import { adaptPlanFromMock } from "../../../exams/mocks/adapt-plan-from-mock";
import { endMockBreak } from "../../../exams/mocks/end-mock-break";
import { getMock } from "../../../exams/mocks/get-mock";
import { saveMockAnswer } from "../../../exams/mocks/save-mock-answer";
import { startMock } from "../../../exams/mocks/start-mock";
import { submitMockSection } from "../../../exams/mocks/submit-mock-section";
import { parsePlanChangePayload } from "../../_utils/plan-change-payload";
import { type RuleAnswer, type RuleEvent } from "../rules/rule-context";
import { SIM_ANSWER_MS, toRuleFormat, toSimAnswer } from "./sim-db-items";
import { type DbRunner, recordDb } from "./sim-db-runner";
import { type SimLife } from "./sim-life-plan";
import { shortHash } from "./sim-session";

/**
 * The database tier's mocks: a session's weekly mock is taken on the mock screen, in real
 * conditions, the way the player sends an exam's Big Challenge there instead of answering it as a
 * checkpoint.
 */

const INPUT = { timeZone: "UTC" };

/**
 * Answers the running section's questions, right on the skills `knows` says, hands it in, and goes
 * on to the next section until the mock is over. Essays stay blank: a model grades them only when
 * the learner asks. A break between sections is cut short, as the learner may.
 */
async function sitSections({
  blockId,
  knows,
}: {
  blockId: string;
  knows: (skillId: string) => boolean;
}): Promise<void> {
  const found = await getMock(blockId);

  if (found.status !== "ready" || found.mock.status === "finished") {
    return;
  }

  const { breakUntil, current } = found.mock;

  if (!current) {
    const ended = breakUntil ? await endMockBreak({ blockId }) : null;
    return ended?.status === "started" ? sitSections({ blockId, knows }) : undefined;
  }

  const asked = current.questions.filter((question) => question.format !== "essay");

  // The learner answers one question after the other.
  await asked.reduce(async (previous, question) => {
    await previous;

    await saveMockAnswer({
      blockId,
      input: {
        answer: toSimAnswer({
          correct: knows(question.skillId),
          format: question.format === "trueFalse" ? "trueFalse" : "multipleChoice",
        }),
        durationMs: SIM_ANSWER_MS,
        flagged: false,
        itemId: question.itemId,
      },
    });
  }, Promise.resolve());

  const handedIn = await submitMockSection({ blockId, input: INPUT, section: current.section });
  return handedIn.status === "next" ? sitSections({ blockId, knows }) : undefined;
}

/**
 * Takes a session's weekly mock from start to finish. Returns its graded answers as the checks
 * read them: the attempts the mock recorded once it was over.
 */
async function playMock({
  at,
  blockId,
  knows,
}: {
  at: Date;
  blockId: string;
  knows: (skillId: string) => boolean;
}): Promise<RuleAnswer[]> {
  const started = await startMock({ blockId, input: INPUT });

  if (started.status !== "ready") {
    return [];
  }

  await sitSections({ blockId, knows });

  const attempts = await prisma.attempt.findMany({
    include: { item: { select: { format: true, set: { select: { kind: true } } } } },
    orderBy: { answeredAt: "asc" },
    where: { mockExam: { blockId, status: "finished" } },
  });

  return attempts.flatMap((attempt) =>
    attempt.skillId
      ? [
          {
            at,
            correct: attempt.isCorrect,
            format: toRuleFormat(attempt.item?.format ?? "multipleChoice"),
            ...(attempt.item?.set?.kind === "audio" && { recording: true }),
            skillId: attempt.skillId,
            source: "mock" as const,
          },
        ]
      : [],
  );
}

/**
 * The learner's yes to a finished mock's offer, through the mock screen's own path. Returns the
 * step the checks read: a test-out by the mock's answers for `skip`, the learner's change for
 * `focus`; null when nothing moved.
 */
async function applyMockOffer({
  answers,
  blockId,
  offer,
}: {
  answers: readonly RuleAnswer[];
  blockId: string;
  offer: NonNullable<SimLife["mockOffers"]>;
}): Promise<RuleEvent | null> {
  const adapted = await adaptPlanFromMock({ blockId, input: { offer, ...INPUT } });

  if (adapted.status !== "applied") {
    return null;
  }

  if (offer === "skip") {
    return { answers, kind: "testOut" };
  }

  const change = adapted.changeId
    ? await prisma.planChange.findUnique({ where: { id: adapted.changeId } })
    : null;

  return change
    ? { kind: "learnerChange", operations: parsePlanChangePayload(change.payload).operations }
    : null;
}

/**
 * What the learner gets right in a mock, which asks the whole exam: the skills they studied (a
 * lesson done, a right answer) unless they miss them that day, and about half of the others, by
 * what they knew before (drawn from the seed and the skill).
 */
function getMockKnowledge(runner: DbRunner, misses: ReadonlySet<string>) {
  const studied = new Set([
    ...(runner.last?.items ?? []).flatMap((item) =>
      item.status === "done" && item.skillId ? [item.skillId] : [],
    ),
    ...runner.answers.flatMap((answer) => (answer.correct ? [answer.skillId] : [])),
  ]);

  return (skillId: string) =>
    !misses.has(skillId) &&
    (studied.has(skillId) || shortHash(`${runner.life.seed}:mock:${skillId}`) % 2 === 0);
}

/**
 * A session's weekly mock, then the learner's answer to what it offers when their life answers it
 * (`SimLife.mockOffers`). The session up to the mock is then a step of its own, so the answer is
 * checked against the plan the finished mock left. Returns the session's answers not yet recorded.
 */
export async function takeMock(
  runner: DbRunner,
  {
    answers,
    blockId,
    index,
    misses,
  }: { answers: RuleAnswer[]; blockId: string; index: number; misses: ReadonlySet<string> },
): Promise<RuleAnswer[]> {
  const knows = getMockKnowledge(runner, misses);
  const taken = await playMock({ at: runner.today, blockId, knows });
  runner.answers.push(...taken);

  const offer = runner.life.mockOffers;
  const found = offer ? await getMock(blockId) : null;

  if (!offer || found?.status !== "ready" || !found.mock.adapt?.[offer]) {
    return [...answers, ...taken];
  }

  await recordDb(runner, {
    event: { answers: [...answers, ...taken], kind: "session" },
    label: "mock",
    step: index,
  });

  const event = await applyMockOffer({ answers: taken, blockId, offer });

  if (event) {
    await recordDb(runner, { event, label: "answer", step: index });
  }

  return [];
}
