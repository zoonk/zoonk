import "server-only";
import { type Item, type TransactionClient } from "@zoonk/db";
import { type z } from "zod";
import { readEssayContent } from "../exams/essays/_utils/essay-content";
import { writtenAnswerSchema } from "../exams/essays/writing-contract";
import { type ClaimEvent } from "./_utils/skill-claims";

type WrittenAnswer = z.infer<typeof writtenAnswerSchema>;
type Sample = { id: string; answer: unknown; answeredAt: Date; item: Item | null; localDate: Date };

function isStrong(grade: WrittenAnswer["grade"]) {
  return (
    grade.criteria.length > 0 &&
    grade.criteria.every(({ level }) => level === "strong" || level === "complete")
  );
}

/** @internal */
export function readWritingEvidence(
  samples: Sample[],
  skillIds: ReadonlySet<string>,
): ClaimEvent[] {
  const last = new Map<string, { day: number; promptIds: Set<string>; strong: boolean }>();

  const ordered = samples.toSorted(
    (first, second) => first.answeredAt.getTime() - second.answeredAt.getTime(),
  );

  return ordered.flatMap(({ answer, answeredAt, id, item, localDate }) => {
    const writing = readEssayContent(item)?.writing;
    const saved = writtenAnswerSchema.safeParse(answer).data;

    if (!item || !writing || !saved || saved.conditions.version !== "firstDraft") {
      return [];
    }

    return writing.assessedSkillIds.flatMap((skillId): ClaimEvent[] => {
      if (!skillIds.has(skillId)) {
        return [];
      }

      const previous = last.get(skillId);
      const day = localDate.getTime();

      if (previous?.promptIds.has(item.id)) {
        return [];
      }

      const promptIds = previous?.promptIds ?? new Set<string>();
      promptIds.add(item.id);

      if (previous && previous.day >= day) {
        return [];
      }

      const strong = isStrong(saved.grade);
      last.set(skillId, { day, promptIds, strong });

      const strongClaim = previous?.strong ? "confirmed" : "toConfirm";

      return [
        {
          at: answeredAt,
          attemptId: id,
          claim: strong ? strongClaim : "gap",
          kind: "writing",
          skillId,
        },
      ];
    });
  });
}

export async function loadWritingEvidence({
  examBlueprintId,
  skillIds,
  tx,
  userId,
}: {
  examBlueprintId: string | null;
  skillIds: ReadonlySet<string>;
  tx: TransactionClient;
  userId: string;
}) {
  if (skillIds.size === 0) {
    return [];
  }

  const samples = await tx.attempt.findMany({
    include: { item: true },
    where: {
      answer: { equals: "firstDraft", path: ["conditions", "version"] },
      item: { examBlueprintId, format: "essay" },
      userId,
    },
  });

  return readWritingEvidence(samples, skillIds);
}

export async function creditWrittenSkills({
  attemptId,
  conditions,
  grade,
  item,
  tx,
}: {
  attemptId: string;
  conditions: WrittenAnswer["conditions"];
  grade: WrittenAnswer["grade"];
  item: Item;
  tx: TransactionClient;
}): Promise<void> {
  const writing = readEssayContent(item)?.writing;

  if (!writing || conditions.version !== "firstDraft") {
    return;
  }

  const attempt = await tx.attempt.findUniqueOrThrow({ where: { id: attemptId } });

  const evidence = await loadWritingEvidence({
    examBlueprintId: item.examBlueprintId,
    skillIds: new Set(writing.assessedSkillIds),
    tx,
    userId: attempt.userId,
  });

  await Promise.all(
    evidence.flatMap((entry) => {
      if (entry.kind !== "writing" || entry.attemptId !== attemptId) {
        return [];
      }

      const developing = isStrong(grade) ? "solid" : "learning";
      const state = entry.claim === "confirmed" ? "mastered" : developing;
      const data = { lastReviewedAt: attempt.answeredAt, state } as const;

      return [
        tx.learnerSkill.upsert({
          create: { ...data, skillId: entry.skillId, userId: attempt.userId },
          update: data,
          where: { userSkill: { skillId: entry.skillId, userId: attempt.userId } },
        }),
      ];
    }),
  );
}
