import { type CourseLevel } from "@zoonk/db";
import {
  array,
  assert,
  boolean,
  constantFrom,
  integer,
  property,
  record,
  subarray,
} from "fast-check";
import { describe, expect, it } from "vitest";
import { type PlacementEvidence, countRightAnswersToKnow } from "./placement-beliefs";
import { type PlacementSkill } from "./placement-graph";
import { listKnownSkillIds, readSkillStatuses } from "./placement-known";
import { type OwnLevel, chooseNextPlacementSkill, isPlacementSettled } from "./placement-steps";

const CHAIN: PlacementSkill[] = [
  { id: "funcoes", order: 0, phase: 0, prerequisiteIds: [], sectionTitle: "Math" },
  { id: "graficos", order: 1, phase: 0, prerequisiteIds: ["funcoes"], sectionTitle: "Math" },
  { id: "modelos", order: 2, phase: 0, prerequisiteIds: ["graficos"], sectionTitle: "Math" },
];

const CLAIMED: PlacementSkill[] = [
  {
    band: "beginner",
    foundation: true,
    id: "adm-atos",
    order: 0,
    phase: 0,
    prerequisiteIds: [],
    sectionTitle: "Administrative law",
  },
  {
    band: "intermediate",
    id: "adm-licitacoes",
    order: 1,
    phase: 1,
    prerequisiteIds: ["adm-atos"],
    sectionTitle: "Administrative law",
  },
  {
    band: "beginner",
    id: "pt-ortografia",
    order: 2,
    phase: 0,
    prerequisiteIds: [],
    sectionTitle: "Portuguese",
  },
  {
    band: "intermediate",
    id: "pt-sintaxe",
    order: 3,
    phase: 1,
    prerequisiteIds: [],
    sectionTitle: "Portuguese",
  },
];

const CONTRADICTED: PlacementSkill[] = [
  {
    band: "intermediate",
    id: "principles",
    order: 0,
    phase: 0,
    prerequisiteIds: [],
    sectionTitle: "Law",
  },
  {
    band: null,
    id: "stateLaw",
    order: 1,
    phase: 0,
    prerequisiteIds: ["principles"],
    sectionTitle: "Law",
  },
  {
    band: "beginner",
    id: "oversight",
    order: 2,
    phase: 0,
    prerequisiteIds: [],
    sectionTitle: "Law",
  },
  {
    band: null,
    id: "audits",
    order: 3,
    phase: 0,
    prerequisiteIds: ["oversight"],
    sectionTitle: "Law",
  },
];

function answer(
  skillId: string,
  outcome: PlacementEvidence["outcome"],
  format: PlacementEvidence["format"] = "multipleChoice",
): PlacementEvidence {
  return { format, outcome, skillId };
}

function statusesOf({
  evidence,
  ...claims
}: {
  evidence: PlacementEvidence[];
  knownAreas?: string[];
  ownLevel?: "intermediate";
}) {
  return readSkillStatuses({
    ...claims,
    answers: evidence,
    evidence,
    focusedSkillIds: new Set(),
    skills: [...CHAIN, ...CLAIMED],
  });
}

describe(readSkillStatuses, () => {
  it("takes as known only what a skill's own answers confirm; what a right answer builds on is to confirm", () => {
    const statuses = statusesOf({
      evidence: [answer("graficos", "correct"), answer("graficos", "correct")],
    });

    expect(["funcoes", "graficos", "modelos"].map((id) => statuses.get(id))).toStrictEqual([
      "inferred",
      "known",
      "unsure",
    ]);
  });

  it("takes nothing the learner only said as known: a subject they know well, the bands below their level", () => {
    const subject = statusesOf({ evidence: [], knownAreas: ["Administrative law"] });
    const level = statusesOf({ evidence: [], ownLevel: "intermediate" });

    expect(subject.get("adm-atos")).toBe("claimed");
    expect(subject.get("adm-licitacoes")).toBe("unsure");

    expect([level.get("adm-atos"), level.get("pt-ortografia")]).toStrictEqual([
      "claimed",
      "claimed",
    ]);

    expect([...subject.values(), ...level.values()]).not.toContain("known");
  });

  it("takes a claimed skill as known once an answer of its own confirms it, and as a gap after a miss", () => {
    const confirmed = statusesOf({
      evidence: [answer("adm-atos", "correct")],
      knownAreas: ["Administrative law"],
    });

    const missed = statusesOf({
      evidence: [answer("adm-atos", "dontKnow")],
      knownAreas: ["Administrative law"],
    });

    expect(confirmed.get("adm-atos")).toBe("known");
    expect(missed.get("adm-atos")).toBe("unknown");
  });

  it("keeps what a skill's own answers decided when its subject's other answers contradict its Library level", () => {
    const evidence = [
      answer("oversight", "wrong"),
      answer("principles", "correct"),
      answer("principles", "correct"),
      answer("oversight", "wrong"),
    ];

    const statuses = readSkillStatuses({
      answers: evidence,
      evidence,
      focusedSkillIds: new Set(),
      skills: CONTRADICTED,
    });

    expect([statuses.get("principles"), statuses.get("oversight")]).toStrictEqual([
      "known",
      "unknown",
    ]);
  });
});

type Learner = {
  format: "multipleChoice" | "trueFalse";
  knownAreas: string[];
  knows: ReadonlySet<string>;
  ownLevel: OwnLevel | null;
  skills: PlacementSkill[];
};

function walk(
  learner: Learner,
  evidence: readonly PlacementEvidence[] = [],
): readonly PlacementEvidence[] {
  const { format, knownAreas, knows, ownLevel, skills } = learner;

  const statuses = readSkillStatuses({
    answers: evidence,
    evidence,
    focusedSkillIds: new Set(),
    knownAreas,
    ownLevel,
    skills,
  });

  const next = isPlacementSettled({ skills, statuses })
    ? null
    : chooseNextPlacementSkill({
        askableSkillIds: new Set(skills.map((skill) => skill.id)),
        evidence,
        ownLevel,
        skills,
        statuses,
      });

  if (!next || evidence.length >= 100) {
    return evidence;
  }

  return walk(learner, [
    ...evidence,
    { format, outcome: knows.has(next) ? "correct" : "wrong", skillId: next },
  ]);
}

const AREAS = ["Law", "Math"];

const learners = record({
  format: constantFrom<Learner["format"]>("multipleChoice", "trueFalse"),
  knownAreas: subarray(AREAS),
  ownLevel: constantFrom<OwnLevel | null>(null, "none", "basic", "intermediate", "advanced"),
  phaseSplit: integer({ max: 8, min: 1 }),
  skills: array(
    record({
      area: constantFrom(...AREAS),
      band: constantFrom<CourseLevel | null>(
        null,
        "overview",
        "beginner",
        "intermediate",
        "advanced",
      ),
      foundation: boolean(),
      knows: boolean(),
      prerequisites: array(boolean(), { maxLength: 7, minLength: 7 }),
    }),
    { maxLength: 8, minLength: 2 },
  ),
}).map(({ phaseSplit, skills, ...learner }): Learner => ({
  ...learner,
  knows: new Set(skills.flatMap((skill, index) => (skill.knows ? [`s${index}`] : []))),
  skills: skills.map((skill, index) => ({
    band: skill.band,
    foundation: skill.foundation,
    id: `s${index}`,
    order: index,
    phase: index < phaseSplit ? 0 : 1,
    prerequisiteIds: skill.prerequisites
      .slice(0, index)
      .flatMap((isPrerequisite, earlier) => (isPrerequisite ? [`s${earlier}`] : [])),
    sectionTitle: skill.area,
  })),
}));

describe("placement with a learner who answers consistently", () => {
  it("settles, asking no skill more often than its own answers need", () => {
    const knowsHarderNotEasier: Learner = {
      format: "multipleChoice",
      knownAreas: [],
      knows: new Set(["principles", "stateLaw"]),
      ownLevel: null,
      skills: CONTRADICTED,
    };

    assert(
      property(learners, (learner) => {
        const evidence = walk(learner);
        const asked = Map.groupBy(evidence, (placementAnswer) => placementAnswer.skillId);

        const statuses = readSkillStatuses({
          answers: evidence,
          evidence,
          focusedSkillIds: new Set(),
          knownAreas: learner.knownAreas,
          ownLevel: learner.ownLevel,
          skills: learner.skills,
        });

        expect(isPlacementSettled({ skills: learner.skills, statuses })).toBe(true);

        expect(
          Math.max(...[...asked.values()].map((answers) => answers.length)),
        ).toBeLessThanOrEqual(countRightAnswersToKnow(learner.format));
      }),
      { examples: [[knowsHarderNotEasier]] },
    );
  });
});

function known(evidence: PlacementEvidence[]) {
  return listKnownSkillIds({
    answers: evidence,
    evidence,
    focusedSkillIds: new Set(),
    skillIds: ["funcoes"],
  });
}

describe(listKnownSkillIds, () => {
  it("takes a true-or-false topic as known after three right answers of its own, never fewer", () => {
    const right = answer("funcoes", "correct", "trueFalse");

    expect(known([right, right])).toStrictEqual([]);
    expect(known([right, right, right])).toStrictEqual(["funcoes"]);
    expect(known([right, right, right, answer("funcoes", "wrong", "trueFalse")])).toStrictEqual([]);
  });
});

describe("what placement asks first", () => {
  it("asks a subject's skills taken on the learner's word first, the earliest first", () => {
    const next = chooseNextPlacementSkill({
      askableSkillIds: new Set(CLAIMED.map((skill) => skill.id)),
      evidence: [],
      ownLevel: "intermediate",
      skills: CLAIMED,
      statuses: statusesOf({ evidence: [], ownLevel: "intermediate" }),
    });

    expect(next).toBe("adm-atos");
  });
});
