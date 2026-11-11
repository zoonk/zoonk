import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getItemAudienceFilter } from "./item-field";

const MAX_USED_SITUATIONS = 8;
const MAX_SITUATION_LENGTH = 200;

type SituationItem = { attempts: readonly unknown[]; content: unknown };

function getItemSituation(content: unknown): string | null {
  const fields = isJsonObject(content) ? content : {};

  const text = [fields.context, fields.question, fields.statement].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );

  return text ? text.replaceAll(/\s+/gu, " ").trim().slice(0, MAX_SITUATION_LENGTH) : null;
}

/** The learner's answered questions come first, so a new case never repeats one they already saw. */
export function toUsedSituations(items: readonly SituationItem[]): string[] {
  const answered = items.filter((item) => item.attempts.length > 0);
  const unanswered = items.filter((item) => item.attempts.length === 0);

  const situations = [...answered, ...unanswered].flatMap(
    (item) => getItemSituation(item.content) ?? [],
  );

  return [...new Set(situations)].slice(0, MAX_USED_SITUATIONS);
}

/**
 * Openings of the questions a learner of this audience can be served for each skill, so a writer
 * adding questions to one of them puts its cases elsewhere.
 */
export async function loadUsedSituations({
  examBlueprintId = null,
  field = null,
  skillIds,
  userId = null,
}: {
  examBlueprintId?: string | null;
  field?: string | null;
  skillIds: readonly string[];
  userId?: string | null;
}): Promise<Map<string, string[]>> {
  if (skillIds.length === 0) {
    return new Map();
  }

  const items = await prisma.item.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      attempts: {
        select: { id: true },
        take: 1,
        where: { userId: { in: userId ? [userId] : [] } },
      },
      content: true,
      skillId: true,
    },
    where: { skillId: { in: [...skillIds] }, ...getItemAudienceFilter({ examBlueprintId, field }) },
  });

  const bySkill = Map.groupBy(items, (item) => item.skillId);

  return new Map(
    skillIds.map((skillId) => [skillId, toUsedSituations(bySkill.get(skillId) ?? [])]),
  );
}
