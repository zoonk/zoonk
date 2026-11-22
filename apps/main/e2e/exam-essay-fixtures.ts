import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { findTodaySession } from "./exam-fixtures";

const STRONG = 160;
const GOOD = 140;
const WEAK = 80;
const ESSAY_SCORES = [STRONG, STRONG, GOOD, STRONG, WEAK];
const INTERVENTION_INDEX = 4;

const ENEM_INSTRUCTION =
  "A partir da leitura dos textos motivadores e com base nos conhecimentos construídos ao longo de sua formação, redija texto dissertativo-argumentativo em modalidade escrita formal da língua portuguesa sobre o tema *Desafios para tornar clara a comunicação dos serviços públicos no Brasil*, apresentando proposta de intervenção que respeite os direitos humanos. Selecione, organize e relacione, de forma coerente e coesa, argumentos e fatos para defesa de seu ponto de vista.";

export async function createEnemEssayDay() {
  const [user, skill, blueprint] = await Promise.all([
    createE2EUser(getBaseURL()),
    skillFixture({ name: `Public communication ${randomUUID()}` }),
    examBlueprintFixture({ identityKey: `enem-${randomUUID()}`, name: "ENEM" }),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    timezone: "UTC",
    title: "ENEM",
    userId: user.id,
  });

  const [item, session] = await Promise.all([
    itemFixture({
      content: {
        context: "Tema: Desafios para tornar clara a comunicação dos serviços públicos no Brasil.",
        keyPoints: ["An intervention proposal with agent, action, means, purpose and a detail"],
        question: ENEM_INSTRUCTION,
        rubric: [
          { criterion: "C1", description: "Formal writing", points: null },
          { criterion: "C5", description: "Intervention proposal", points: null },
        ],
        sampleOutline: "Thesis, two arguments, an intervention proposal.",
      },
      examBlueprintId: blueprint.id,
      format: "essay",
      skillId: skill.id,
    }),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    planFixture({ goalId: goal.id }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  const block = await studySessionBlockFixture({
    estimatedMinutes: 20,
    kind: "produce",
    payload: { itemIds: [item.id], skillIds: [skill.id], title: "Essay" },
    sessionId: session.id,
    startedAt: new Date(),
    status: "active",
  });

  return { blockId: block.id, goalId: goal.id, user };
}

export async function addGradedEssay({ goalId, userId }: { goalId: string; userId: string }) {
  const [goal, session] = await Promise.all([
    prisma.goal.findUniqueOrThrow({ where: { id: goalId } }),
    findTodaySession({ goalId, userId }),
  ]);

  const essay = await prisma.item.findFirstOrThrow({
    where: { examBlueprintId: goal.examBlueprintId, format: "essay" },
  });

  const block = await studySessionBlockFixture({
    estimatedMinutes: 20,
    kind: "produce",
    payload: { itemIds: [essay.id], skillIds: [essay.skillId], title: "Essay" },
    sessionId: session.id,
    startedAt: new Date(),
    status: "active",
  });

  await prisma.attempt.create({
    data: {
      answer: {
        grade: {
          criteria: ESSAY_SCORES.map((score, index) => ({
            comment: `Comment on competency ${index + 1}.`,
            example: index === INTERVENTION_INDEX ? "por meio de campanhas nas escolas" : null,
            id: `c${index + 1}`,
            maxScore: 200,
            name: `C${index + 1}`,
            quote: null,
            score,
          })),
          enemInterventionElements: {
            action: true,
            agent: true,
            detail: false,
            effect: true,
            means: false,
          },
          nextStep: { criterionId: "c5", text: "Say by what means the proposal will work." },
          range: { high: 740, low: 660 },
          total: { maxScore: 1000, score: ESSAY_SCORES.reduce((sum, score) => sum + score, 0) },
          zeroReason: null,
        },
        text: "Meu primeiro rascunho da redação.",
      },
      durationMs: 600_000,
      hour: 12,
      isCorrect: true,
      itemId: essay.id,
      localDate: session.localDate,
      score: 0.7,
      skillId: essay.skillId,
      studySessionId: session.id,
      userId,
      weekday: session.localDate.getUTCDay(),
    },
  });

  return { blockId: block.id };
}
