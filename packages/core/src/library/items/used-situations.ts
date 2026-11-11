import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getItemAudienceFilter } from "./item-field";

const MAX_SITUATION_LENGTH = 200;

function getOpening(content: unknown, fields: readonly string[]): string | null {
  const values = isJsonObject(content) ? content : {};

  const text = fields
    .map((field) => values[field])
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);

  return text ? text.replaceAll(/\s+/gu, " ").trim().slice(0, MAX_SITUATION_LENGTH) : null;
}

/** A chart set may have no text or title around it, so its chart's title names the case. */
function getSetSituation(content: unknown): string | null {
  const visual = isJsonObject(content) ? content.visual : null;
  return getOpening(content, ["text", "title"]) ?? getOpening(visual, ["title"]);
}

/** A set's questions share its stimulus, which is their case. */
function getItemSituation(item: { content: unknown; set: { content: unknown } | null }) {
  return item.set
    ? getSetSituation(item.set.content)
    : getOpening(item.content, ["context", "question", "statement"]);
}

/**
 * Openings of every question a learner of this audience can be served for each skill, sets
 * included, so a writer adding questions to one of them puts its cases elsewhere.
 */
export async function loadUsedSituations({
  examBlueprintId = null,
  field = null,
  skillIds,
}: {
  examBlueprintId?: string | null;
  field?: string | null;
  skillIds: readonly string[];
}): Promise<Map<string, string[]>> {
  if (skillIds.length === 0) {
    return new Map();
  }

  const items = await prisma.item.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: { content: true, set: { select: { content: true } }, skillId: true },
    where: {
      skillId: { in: [...skillIds] },
      ...getItemAudienceFilter({ examBlueprintId, field, inSets: true }),
    },
  });

  const bySkill = Map.groupBy(items, (item) => item.skillId);

  return new Map(
    skillIds.map((skillId) => {
      const situations = (bySkill.get(skillId) ?? []).flatMap(
        (item) => getItemSituation(item) ?? [],
      );

      return [skillId, [...new Set(situations)]];
    }),
  );
}
