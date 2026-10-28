import { describe, expect, it } from "vitest";
import { type QueueUnit } from "./plan-units";
import { type Worth, rankShortAreas } from "./rank-cores";

const AREA = "Portuguese";

function core(skillId: string, attrs: Partial<QueueUnit> = {}): QueueUnit {
  return {
    area: AREA,
    chapterId: null,
    key: `skill:${skillId}`,
    kind: "lesson",
    lessonId: null,
    minutes: 10,
    phase: 0,
    skillId,
    title: skillId,
    ...attrs,
  };
}

function worthOf({
  announcedTopics = [],
  bases = [],
  gaps = [],
  known = [],
  prerequisites = {},
  topics = {},
  units,
}: {
  announcedTopics?: string[];
  bases?: string[];
  gaps?: string[];
  known?: string[];
  prerequisites?: Record<string, string[]>;
  topics?: Record<string, string[]>;
  units: readonly QueueUnit[];
}): Worth {
  const skillIds = units.flatMap((unit) => (unit.skillId ? [unit.skillId] : []));

  const topicsOf = (skillId: string) =>
    bases.includes(skillId) ? [] : (topics[skillId] ?? [skillId]);

  return {
    announcedTopics: new Set(announcedTopics),
    focused: new Set(),
    gaps: new Set(gaps),
    known: new Set(known),
    prerequisites: new Map(Object.entries(prerequisites)),
    topics: new Map(
      skillIds.map((skillId) => [
        skillId,
        topicsOf(skillId).map((topic) => ({ key: topic, score: 3 })),
      ]),
    ),
    values: new Map(skillIds.map((skillId) => [skillId, 1])),
  };
}

function rankWithin({
  budget,
  units,
  worth,
}: {
  budget: number;
  units: readonly QueueUnit[];
  worth: Worth;
}) {
  const total = units.reduce((sum, unit) => sum + unit.minutes, 0);
  const [ranked] = rankShortAreas({ missing: new Map([[AREA, total - budget]]), units, worth });

  return { kept: [...(ranked?.kept ?? [])].toSorted(), order: ranked?.order ?? [] };
}

describe(rankShortAreas, () => {
  it("ranks the cheapest way into a topic as missed when another skill teaching it was missed", () => {
    const units = [
      core("chemistry", { minutes: 30 }),
      core("tissues", { minutes: 10 }),
      core("ecology", { minutes: 20 }),
      core("cells", { minutes: 20 }),
    ];

    const { kept } = rankWithin({
      budget: 20,
      units,
      worth: worthOf({
        bases: ["chemistry"],
        gaps: ["tissues"],
        prerequisites: { tissues: ["chemistry"] },
        topics: { cells: ["cells"], tissues: ["cells"] },
        units,
      }),
    });

    expect(kept).toStrictEqual(["cells"]);
  });

  it("counts only the missed topics of a way in that ranks as missed", () => {
    const units = [core("genres"), core("correspondence"), core("drafting", { minutes: 20 })];

    const { kept } = rankWithin({
      budget: 30,
      units,
      worth: worthOf({
        gaps: ["drafting", "genres"],
        prerequisites: { correspondence: ["genres"], drafting: ["genres"] },
        topics: { correspondence: ["letters", "memos"] },
        units,
      }),
    });

    expect(kept).toStrictEqual(["drafting", "genres"]);
  });

  it("ranks a skill as announced when it brings in an announced skill's topic", () => {
    const units = [core("viruses"), core("membrane"), core("osmosis")];

    const { kept } = rankWithin({
      budget: 10,
      units,
      worth: worthOf({
        announcedTopics: ["osmosis"],
        known: ["osmosis"],
        topics: { membrane: ["osmosis"] },
        units,
      }),
    });

    expect(kept).toStrictEqual(["membrane"]);
  });

  it("keeps the time for a missed topic's way in that fits in part, before topics nobody missed", () => {
    const units = [
      core("tables"),
      core("visualization", { minutes: 12 }),
      core("networks"),
      core("security"),
    ];

    const ranked = rankWithin({
      budget: 20,
      units,
      worth: worthOf({
        bases: ["tables"],
        gaps: ["visualization"],
        prerequisites: { visualization: ["tables"] },
        units,
      }),
    });

    expect(ranked).toStrictEqual({
      kept: [],
      order: ["tables", "visualization", "networks", "security"],
    });
  });
});
