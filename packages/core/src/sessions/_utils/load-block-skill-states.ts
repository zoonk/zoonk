import { type MasteryState, prisma } from "@zoonk/db";
import { type SessionAnswer } from "./session-answers";

export async function loadBlockSkillStates({
  answers,
  userId,
}: {
  answers: readonly SessionAnswer[];
  userId: string;
}) {
  const skillIds = [
    ...new Set(answers.flatMap((answer) => (answer.skillId ? [answer.skillId] : []))),
  ];

  const rows = await prisma.learnerSkill.findMany({
    select: { skillId: true, state: true },
    where: { skillId: { in: skillIds }, userId },
  });

  return Object.fromEntries(rows.map((row): [string, MasteryState] => [row.skillId, row.state]));
}
