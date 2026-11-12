import { type Attempt, type LearnerSkill, type Mistake, prisma } from "@zoonk/db";
import { toUTCMidnight } from "@zoonk/utils/date";
import { getString } from "@zoonk/utils/json";
import { type FixtureAttrs } from "./_utils/fixture-attrs";

const DEFAULT_ATTEMPT_DURATION_MS = 5000;

export async function learnerSkillFixture(
  attrs: FixtureAttrs<LearnerSkill> & Pick<LearnerSkill, "skillId" | "userId">,
) {
  return prisma.learnerSkill.create({ data: attrs });
}

/** The local date, hour and weekday come from `answeredAt` in UTC. */
export async function attemptFixture(
  attrs: FixtureAttrs<Attempt, "answer"> & Pick<Attempt, "userId">,
) {
  const answeredAt = attrs.answeredAt ?? new Date();

  return prisma.attempt.create({
    data: {
      answer: { selectedIndex: 0 },
      durationMs: DEFAULT_ATTEMPT_DURATION_MS,
      hour: answeredAt.getUTCHours(),
      isCorrect: true,
      localDate: toUTCMidnight(answeredAt),
      weekday: answeredAt.getUTCDay(),
      ...attrs,
      answeredAt,
    },
  });
}

async function originalQuestion(attrs: Pick<Mistake, "itemId" | "stepId">): Promise<string> {
  if (attrs.stepId) {
    const step = await prisma.step.findUnique({ where: { id: attrs.stepId } });

    if (step) {
      const question = getString(step.content, "question") ?? getString(step.content, "template");
      const context = getString(step.content, "context");

      if (question) {
        return [context, question].filter(Boolean).join("\n\n");
      }

      if (step.sentenceId && (step.kind === "reading" || step.kind === "listening")) {
        const link = await prisma.lessonSentence.findUnique({
          include: { sentence: true },
          where: { lessonId_sentenceId: { lessonId: step.lessonId, sentenceId: step.sentenceId } },
        });

        if (link) {
          return step.kind === "reading" ? link.translation : link.sentence.sentence;
        }
      }

      if (step.wordId && step.kind === "translation") {
        const link = await prisma.lessonWord.findUnique({
          select: { translation: true },
          where: { lessonId_wordId: { lessonId: step.lessonId, wordId: step.wordId } },
        });

        if (link) {
          return link.translation;
        }
      }

      const target = getString(step.content, "targetText");

      if (target) {
        return [getString(step.content, "prompt"), target].filter(Boolean).join("\n\n");
      }
    }
  }

  if (attrs.itemId) {
    const item = await prisma.item.findUnique({
      select: { content: true },
      where: { id: attrs.itemId },
    });

    if (item) {
      return (
        getString(item.content, "question") ??
        getString(item.content, "statement") ??
        "Test question?"
      );
    }
  }

  return "Test question?";
}

export async function mistakeFixture(
  attrs: FixtureAttrs<Mistake, "snapshot"> & Pick<Mistake, "userId">,
) {
  const question = await originalQuestion({
    itemId: attrs.itemId ?? null,
    stepId: attrs.stepId ?? null,
  });

  return prisma.mistake.create({
    data: { missedAt: attrs.createdAt, snapshot: { answer: "Wrong answer", question }, ...attrs },
  });
}
