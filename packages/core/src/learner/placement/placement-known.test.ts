import { describe, expect, it } from "vitest";
import { type PlacementEvidence } from "./placement-beliefs";
import { type PlacementSkill } from "./placement-graph";
import { listKnownSkillIds, readSkillStatuses } from "./placement-known";
import { chooseNextPlacementSkill } from "./placement-steps";

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
