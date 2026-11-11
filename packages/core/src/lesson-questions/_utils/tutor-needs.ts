import "server-only";
import { type LearnerNeeds } from "@zoonk/ai/tasks/tutor/learner-needs";
import { type TransactionClient, prisma } from "@zoonk/db";
import { type AddressForm } from "@zoonk/db/enums";
import { currentFactsWhere } from "../../memory/_utils/memory-fact-view";

/**
 * `personal` also counts the support note, which reaches the tutor through memory rather than
 * `needs`. It leaves out the address form: a shared answer is written neutral instead.
 */
export async function getTutorNeeds({
  client = prisma,
  task,
  userId,
}: {
  client?: TransactionClient;
  task: "goal" | "lesson";
  userId: string;
}): Promise<{ addressForm: AddressForm | null; needs: LearnerNeeds; personal: boolean }> {
  const [profile, conditions, supportNote] = await Promise.all([
    client.userLearningProfile.findUnique({ where: { userId } }),
    client.learnerCondition.findMany({ orderBy: { condition: "asc" }, where: { userId } }),
    client.memoryFact.findFirst({
      select: { id: true },
      where: {
        ...currentFactsWhere({ now: new Date(), userId }),
        AND: [
          { sourceRef: { equals: "profile", path: ["kind"] } },
          { sourceRef: { equals: "learningSupport", path: ["id"] } },
        ],
      },
    }),
  ]);

  const needs = {
    note: conditions.find(({ condition }) => condition === "other")?.note ?? null,
    variants: [
      ...(profile?.learningNeeds ?? []).filter((need) => need !== "shorterDays" || task === "goal"),
      ...conditions
        .filter(({ condition }) => condition !== "motor")
        .map(({ condition }) => condition),
    ],
  };

  const memoryEnabled = profile?.memoryEnabled ?? true;

  return {
    addressForm: profile?.addressForm ?? null,
    needs,
    personal:
      needs.variants.length > 0 || needs.note !== null || (memoryEnabled && supportNote !== null),
  };
}
