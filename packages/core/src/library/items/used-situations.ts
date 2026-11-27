import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getItemAudienceFilter, getPublicItemFilter } from "./item-field";

const MAX_SITUATION_LENGTH = 200;

export function toSituationOpening(text: string) {
  return text.replaceAll(/\s+/gu, " ").trim().slice(0, MAX_SITUATION_LENGTH);
}

function getOpening(content: unknown, fields: readonly string[]): string | null {
  const values = isJsonObject(content) ? content : {};

  const text = fields
    .map((field) => values[field])
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);

  return text ? toSituationOpening(text) : null;
}

function getTranscript(content: unknown): { text: string } {
  const script = isJsonObject(content) ? content.script : null;
  const turns = isJsonObject(script) && Array.isArray(script.turns) ? script.turns : [];
  const lines = turns.map((turn) => (isJsonObject(turn) ? turn.text : null));
  return { text: lines.filter((line) => typeof line === "string").join(" ") };
}

/**
 * A chart set may have no text or title around it, and an audio set loses a title that gives an
 * answer away, so their chart's title or the audio's opening lines name the case.
 */
function getSetSituation(content: unknown): string | null {
  const visual = isJsonObject(content) ? content.visual : null;

  return (
    getOpening(content, ["text", "title"]) ??
    getOpening(visual, ["title"]) ??
    getOpening(getTranscript(content), ["text"])
  );
}

/** A set's questions share its stimulus, which is their case. */
export function getItemSituation(item: { content: unknown; set: { content: unknown } | null }) {
  return item.set
    ? getSetSituation(item.set.content)
    : getOpening(item.content, ["context", "question", "statement"]);
}

/**
 * Openings of every question a learner of this audience can be served for each skill, sets
 * included, so a writer adding questions to one of them puts its cases elsewhere. A lesson being
 * rewritten passes its id, since its own screens' questions are what it rewrites, not cases to avoid.
 */
export async function loadUsedSituations({
  examBlueprintId = null,
  field = null,
  includeMockReserve = false,
  lessonId,
  publicOnly = false,
  skillIds,
}: {
  examBlueprintId?: string | null;
  field?: string | null;
  includeMockReserve?: boolean;
  lessonId?: string;
  publicOnly?: boolean;
  skillIds: readonly string[];
}): Promise<Map<string, string[]>> {
  if (skillIds.length === 0) {
    return new Map();
  }

  const audience = getItemAudienceFilter({ examBlueprintId, field, inSets: true });
  const reserve = { ...getPublicItemFilter(), mockOnly: true, retiredAt: null };

  const items = await prisma.item.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: { content: true, set: { select: { content: true } }, skillId: true },
    where: {
      AND: [
        ...(publicOnly ? getPublicItemFilter().AND : []),
        includeMockReserve ? { OR: [audience, reserve] } : audience,
        ...(lessonId ? [{ steps: { none: { lessonId } } }] : []),
      ],
      skillId: { in: [...skillIds] },
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
