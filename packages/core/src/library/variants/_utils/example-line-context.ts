import "server-only";
import { createHash } from "node:crypto";
import { type TransactionClient, prisma } from "@zoonk/db";
import { currentFactsWhere } from "../../../memory/_utils/memory-fact-view";
import { memorySourceSchema } from "../../../memory/memory-contract";

export type ExampleLineContext = {
  learnerHomeCountry: string | null;
  facts: { id: string; statement: string }[];
  goal: string | null;
  key: string;
  plainWords: boolean;
};

async function findEligibleFacts({
  client,
  memoryEnabled,
  userId,
}: {
  client: TransactionClient;
  memoryEnabled: boolean;
  userId: string;
}) {
  if (!memoryEnabled) {
    return [];
  }

  const facts = await client.memoryFact.findMany({
    select: { id: true, sourceRef: true, statement: true },
    where: { ...currentFactsWhere({ now: new Date(), userId }), sensitive: false },
  });

  return facts.flatMap(({ id, sourceRef, statement }) => {
    const source = memorySourceSchema.safeParse(sourceRef);

    return source.success && source.data.kind === "profile" && source.data.id === "learningSupport"
      ? []
      : [{ id, statement }];
  });
}

function hashContext({
  facts,
  goal,
  learnerHomeCountry,
  plainWords,
}: Omit<ExampleLineContext, "key">): string {
  const statements = facts.map((fact) => fact.statement).toSorted();
  // Lines saved before learners could say where they live keep their key while they still haven't.
  const home = learnerHomeCountry ? { learnerHomeCountry } : {};

  return createHash("sha256")
    .update(JSON.stringify({ goal, ...home, plainWords, statements }))
    .digest("hex");
}

export async function loadExampleLineContext({
  client = prisma,
  userId,
}: {
  client?: TransactionClient;
  userId: string;
}): Promise<ExampleLineContext | null> {
  const profile = await client.userLearningProfile.findUnique({
    include: { activeGoal: { select: { status: true, title: true } } },
    where: { userId },
  });

  const facts = await findEligibleFacts({
    client,
    memoryEnabled: profile?.memoryEnabled ?? true,
    userId,
  });

  if (facts.length === 0) {
    return null;
  }

  const context = {
    facts,
    goal: profile?.activeGoal?.status === "active" ? profile.activeGoal.title : null,
    learnerHomeCountry: profile?.homeCountry ?? null,
    plainWords: profile?.learningNeeds.includes("plainWords") ?? false,
  };

  return { ...context, key: hashContext(context) };
}
