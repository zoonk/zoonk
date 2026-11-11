import { isDeepStrictEqual } from "node:util";
import { type MemoryFact, type TransactionClient } from "@zoonk/db";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { type EntitlementViewer } from "../../../entitlements/_utils/entitlement-viewer";
import { claimAssistInWrite } from "../../../entitlements/claim-usage";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
import { forgetExampleLines } from "../../../memory/_utils/forget-example-lines";
import { LEARNER_CONFIDENCE } from "../../../memory/_utils/memory-candidates";
import { type ProfileAnswerInput } from "../profile-question-contract";
import { toProfileFacts } from "../profile-statements";

export async function replaceProfileFacts({
  tx,
  userId,
  input,
  locale,
  viewer,
  existing,
}: {
  tx: TransactionClient;
  userId: string;
  input: ProfileAnswerInput;
  locale: SupportedLocale;
  viewer: EntitlementViewer | null;
  existing: MemoryFact[];
}): Promise<boolean> {
  const desired = toProfileFacts({ ...input, locale });

  const matches = (fact: MemoryFact, next: (typeof desired)[number]) =>
    fact.statement === next.statement && isDeepStrictEqual(fact.profileAnswer, next.profileAnswer);

  const kept = existing
    .filter((fact) => desired.some((next) => matches(fact, next)))
    .map((fact) => fact.id);

  const added = desired.filter((next) => !existing.some((fact) => matches(fact, next)));

  const questionFacts = {
    AND: [
      { sourceRef: { equals: "profile", path: ["kind"] } },
      { sourceRef: { equals: input.question, path: ["id"] } },
    ],
    userId,
  };

  await tx.memoryFact.updateMany({
    data: { deletedAt: new Date(), status: "superseded" },
    where: {
      ...questionFacts,
      OR: [{ status: "active" }, { deletedAt: null, status: "superseded" }],
      id: { notIn: kept },
    },
  });

  // A newer profile answer closes earlier Memory undos without moving existing purge dates.
  await tx.memoryFact.updateMany({
    data: { status: "superseded", supersededById: null },
    where: { ...questionFacts, status: { in: ["deleted", "superseded"] } },
  });

  const created = await tx.memoryFact.createManyAndReturn({
    data: added.map((fact) => ({
      ...fact,
      confidence: LEARNER_CONFIDENCE,
      origin: "said",
      sourceRef: { id: input.question, kind: "profile" },
      userId,
    })),
  });

  const checked: typeof created = [];

  for (const fact of created.filter((item) => item.sensitive)) {
    // oxlint-disable-next-line no-await-in-loop -- Each claim must see the preceding claim in this transaction.
    if (viewer && (await claimAssistInWrite({ transaction: tx, viewer }))) {
      checked.push(fact);
    }
  }

  if (checked.length > 0) {
    await oweFollowUps({
      db: tx,
      followUps: checked.map((fact) => ({
        input: { factId: fact.id, statement: fact.statement },
        kind: "checkFactSensitivity",
      })),
      userId,
    });
  }

  if (existing.some((fact) => !kept.includes(fact.id)) || created.length > 0) {
    await forgetExampleLines({ client: tx, userId });
  }

  return checked.length > 0;
}
