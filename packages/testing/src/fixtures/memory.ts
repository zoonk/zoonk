import { type MemoryFact, type MemoryInsight, type Milestone, prisma } from "@zoonk/db";
import { toUTCMidnight } from "@zoonk/utils/date";
import { type FixtureAttrs } from "./_utils/fixture-attrs";

/** Stores an active fact the learner said about their goals. */
export async function memoryFactFixture(
  attrs: FixtureAttrs<MemoryFact, "sourceRef"> & Pick<MemoryFact, "userId">,
) {
  return prisma.memoryFact.create({
    data: { category: "goals", origin: "said", statement: "Wants to pass a test exam", ...attrs },
  });
}

/** Records today's insight check for a learner: a pending tip unless `kind` and `message` say otherwise. */
export async function memoryInsightFixture(
  attrs: FixtureAttrs<MemoryInsight, "payload"> & Pick<MemoryInsight, "userId">,
) {
  return prisma.memoryInsight.create({
    data: {
      inputHash: `test-hash-${crypto.randomUUID()}`,
      kind: "tip",
      localDate: toUTCMidnight(new Date()),
      message: "Try a two-minute break before the last questions.",
      ...attrs,
    },
  });
}

/** Records an earned milestone (a badge unless `kind` says otherwise). */
export async function milestoneFixture(attrs: FixtureAttrs<Milestone> & Pick<Milestone, "userId">) {
  return prisma.milestone.create({
    data: { key: `test-badge-${crypto.randomUUID()}`, kind: "badge", ...attrs },
  });
}
