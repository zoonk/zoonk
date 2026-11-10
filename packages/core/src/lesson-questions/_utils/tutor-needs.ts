import "server-only";
import { type LearnerNeeds } from "@zoonk/ai/tasks/tutor/learner-needs";
import { type TransactionClient, prisma } from "@zoonk/db";

export async function getTutorNeeds({
  client = prisma,
  task,
  userId,
}: {
  client?: TransactionClient;
  task: "goal" | "lesson";
  userId: string;
}): Promise<LearnerNeeds> {
  const [profile, conditions] = await Promise.all([
    client.userLearningProfile.findUnique({ where: { userId } }),
    client.learnerCondition.findMany({ orderBy: { condition: "asc" }, where: { userId } }),
  ]);

  return {
    note: conditions.find(({ condition }) => condition === "other")?.note ?? null,
    variants: [
      ...(profile?.learningNeeds ?? []).filter((need) => need !== "shorterDays" || task === "goal"),
      ...conditions
        .filter(({ condition }) => condition !== "motor")
        .map(({ condition }) => condition),
    ],
  };
}
