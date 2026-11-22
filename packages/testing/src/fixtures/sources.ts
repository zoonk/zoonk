import { randomUUID } from "node:crypto";
import {
  type ExamBlueprint,
  type GoalSource,
  type LearnerSource,
  type Source,
  type SourceChangeNotice,
  prisma,
} from "@zoonk/db";
import { type FixtureAttrs, fixtureProvenance } from "./_utils/fixture-attrs";

export async function sourceFixture(attrs?: FixtureAttrs<Source, "reusePolicy" | "structure">) {
  const key = randomUUID();
  const url = `https://example.test/sources/${key}`;

  return prisma.source.create({
    data: {
      contentHash: `test-hash-${key}`,
      fetchedAt: new Date(),
      identityKey: url,
      kind: "official",
      language: "en",
      title: "Test source",
      url,
      ...attrs,
    },
  });
}

export async function examBlueprintFixture(
  attrs?: FixtureAttrs<ExamBlueprint, "edition" | "structure" | "topicFrequency">,
) {
  return prisma.examBlueprint.create({
    data: {
      country: "BR",
      identityKey: `test-exam-${randomUUID()}`,
      language: "en",
      name: "Test Exam",
      structure: { formats: ["multipleChoice"], subjects: [{ name: "Test subject", weight: 1 }] },
      ...fixtureProvenance(),
      ...attrs,
    },
  });
}

/** With `goalId`, the goal reads the source too, as the learner's material or research's find. */
export async function learnerSourceFixture({
  goalId,
  ...attrs
}: FixtureAttrs<LearnerSource> &
  Pick<LearnerSource, "sourceId" | "userId"> & { goalId?: string | null }) {
  const link = await prisma.learnerSource.create({ data: { origin: "upload", ...attrs } });

  if (goalId) {
    await goalSourceFixture({ goalId, origin: link.origin, sourceId: link.sourceId });
  }

  return link;
}

export async function goalSourceFixture(
  attrs: FixtureAttrs<GoalSource> & Pick<GoalSource, "goalId" | "sourceId">,
) {
  return prisma.goalSource.create({ data: { origin: "upload", ...attrs } });
}

export async function sourceChangeNoticeFixture(
  attrs: FixtureAttrs<SourceChangeNotice> & Pick<SourceChangeNotice, "sourceId">,
) {
  return prisma.sourceChangeNotice.create({
    data: {
      contentHash: `test-hash-${randomUUID()}`,
      fields: ["edition.questionCount"],
      language: "en",
      message: "The exam notice changed: the test now has 60 questions.",
      previousHash: `test-hash-${randomUUID()}`,
      ...fixtureProvenance(),
      ...attrs,
    },
  });
}

export async function unnoticedSourceChangeFixture({
  changedAt = new Date(),
  changes = "- Test source text before it changed.\n+ Test source text after it changed.",
  previousHash = `test-hash-${randomUUID()}`,
  sourceId,
}: {
  changedAt?: Date;
  changes?: string;
  previousHash?: string;
  sourceId: string;
}) {
  const source = await prisma.source.update({
    data: {
      unnoticedChangedAt: changedAt,
      unnoticedChanges: changes,
      unnoticedFromHash: previousHash,
      unnoticedRevision: { increment: 1 },
    },
    where: { id: sourceId },
  });

  return { previousHash, revision: source.unnoticedRevision };
}
