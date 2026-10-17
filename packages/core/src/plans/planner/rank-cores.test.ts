import { describe, expect, it } from "vitest";
import { type QueueUnit } from "./plan-units";
import { type Worth, rankShortAreas } from "./rank-cores";

const AREA = "Portuguese";

/** A skill's core in one area, 10 minutes unless `attrs` says otherwise. */
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

/**
 * What the cut reads: each skill teaches the topics `topics` gives it (one of its own by default),
 * every topic asked most; skills of `bases` teach none.
 */
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

/** The area's cores in the order the cut keeps them, and the ones that fit in `budget` minutes. */
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
  // ENEM's placement missed a skill on molecules, cells and tissues, whose base alone took the
  // time left. The topic's cheapest way in, which the learner wasn't asked about, ranked as
  // unmissed and left for ecology, asked as often. A topic is missed when any skill teaching it was.
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

  // Câmara's placement missed text genres and legislative drafting, which builds on it. Official
  // correspondence, which nobody missed, builds on text genres too: bundled with that base, its
  // topics counted as missed and made it the cheaper way per topic, so it kept its lessons while
  // legislative drafting stayed out.
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

  // The teacher announced an essay on osmosis, which the learner answered right once. The cell
  // membrane's lessons are the way into the osmosis topic, which the test asks for certain, yet
  // a settle set them aside while unannounced viruses kept theirs.
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

  // Câmara's data visualization, which placement missed, came 2 minutes over the time its subject
  // had with its base, and networks and digital security, asked as often and missed by nobody,
  // took that time whole. The first way skipped is the one the deadline cuts in part, its base
  // first, so nothing ranked below it keeps the time.
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
