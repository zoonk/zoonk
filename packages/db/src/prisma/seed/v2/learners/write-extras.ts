import { daysFrom } from "../_utils/dates";
import { SEED_PROVENANCE } from "../_utils/provenance";
import { seedId } from "../_utils/seed-id";
import { type LearnerScope, planItemId } from "./write-goal";

const NOTICED_CONFIDENCE = 0.8;

/** Short facts the learner shared at onboarding or that their activity showed. */
async function writeMemory({ learner, now, prisma, userId }: LearnerScope) {
  await Promise.all(
    learner.memory.map((fact, index) => {
      const id = seedId(`learner:${learner.key}:memory:${index}`);

      const data = {
        category: fact.category,
        confidence: fact.origin === "noticed" ? NOTICED_CONFIDENCE : null,
        createdAt: daysFrom(now, -index - 1),
        origin: fact.origin,
        sourceRef: { kind: fact.origin === "said" ? "onboarding" : "activity" },
        statement: fact.statement,
        userId,
        ...(fact.origin === "noticed" ? SEED_PROVENANCE : {}),
      };

      return prisma.memoryFact.upsert({ create: { id, ...data }, update: data, where: { id } });
    }),
  );
}

function findBossItemId(scope: LearnerScope, day: number): string | null {
  const { goal } = scope.learner;
  const position = goal.plan.items.findIndex((item) => item.kind === "boss" && item.day === day);

  return position === -1 ? null : planItemId(scope.learner, goal, position);
}

/** Belts, badges, glasses and buddy stages earned, each celebrated once. */
async function writeMilestones(scope: LearnerScope) {
  const { learner, now, prisma, userId } = scope;

  await Promise.all(
    learner.milestones.map((milestone) => {
      const earnedAt = daysFrom(now, milestone.day);
      const data = { earnedAt, shownAt: milestone.shown ? earnedAt : null };

      const boss =
        milestone.bossDay === undefined ? null : findBossItemId(scope, milestone.bossDay);

      const key = boss ? `${milestone.key}:${boss}` : milestone.key;

      return prisma.milestone.upsert({
        create: { ...data, key, kind: milestone.kind, userId },
        update: data,
        where: { userMilestone: { key, kind: milestone.kind, userId } },
      });
    }),
  );
}

/** Thumbs on lessons and questions, with the provenance of what was voted on. */
async function writeFeedback({ learner, lookup, prisma, userId }: LearnerScope) {
  await Promise.all(
    learner.feedback.map((vote) => {
      const contentId = vote.lesson ? lookup.lesson(vote.lesson).id : lookup.item(vote.item ?? "");

      const data = {
        comment: vote.comment ?? null,
        language: learner.language,
        mode: learner.mode,
        reasons: vote.reasons ?? [],
        vote: vote.vote,
        ...SEED_PROVENANCE,
      };

      return prisma.contentFeedback.upsert({
        create: { ...data, contentId, contentKind: vote.kind, userId },
        update: data,
        where: { userContent: { contentId, contentKind: vote.kind, userId } },
      });
    }),
  );
}

export async function writeLearnerExtras(scope: LearnerScope): Promise<void> {
  await Promise.all([writeMemory(scope), writeMilestones(scope), writeFeedback(scope)]);
}
