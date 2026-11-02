import { randomUUID } from "node:crypto";
import {
  type ExamBlueprint,
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

export async function learnerSourceFixture(
  attrs: FixtureAttrs<LearnerSource> & Pick<LearnerSource, "sourceId" | "userId">,
) {
  return prisma.learnerSource.create({ data: { origin: "upload", ...attrs } });
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
