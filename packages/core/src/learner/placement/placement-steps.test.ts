import { describe, expect, it } from "vitest";
import { type PlacementEvidence, getPlacementBeliefs } from "./placement-beliefs";
import { getTargetDifficulty } from "./placement-difficulty";
import { type PlacementSkill } from "./placement-graph";
import {
  chooseNextPlacementSkill,
  getAreaStarts,
  getPhaseStarts,
  getScratchAreaStarts,
  getScratchPhaseStarts,
  getSkillPlacementStatus,
  isPlacementSettled,
  pickPlacementItem,
} from "./placement-steps";

/**
 * Two phases of a chain: a -> b -> c (phase 0) -> d -> e (phase 1). Each skill needs the one before.
 */
const CHAIN: PlacementSkill[] = [
  { id: "a", order: 0, phase: 0, prerequisiteIds: [], sectionTitle: null },
  { id: "b", order: 1, phase: 0, prerequisiteIds: ["a"], sectionTitle: null },
  { id: "c", order: 2, phase: 0, prerequisiteIds: ["b"], sectionTitle: null },
  { id: "d", order: 3, phase: 1, prerequisiteIds: ["c"], sectionTitle: null },
  { id: "e", order: 4, phase: 1, prerequisiteIds: ["d"], sectionTitle: null },
];

const ALL_ASKABLE = new Set(CHAIN.map((skill) => skill.id));

/**
 * An exam with two subjects interleaved in plan order, like the plan puts them: math m1 -> m2 ->
 * m3 and history h1 -> h2 -> h3, one phase.
 */
const EXAM: PlacementSkill[] = [
  { id: "m1", order: 0, phase: 0, prerequisiteIds: [], sectionTitle: "Math" },
  { id: "h1", order: 1, phase: 0, prerequisiteIds: [], sectionTitle: "History" },
  { id: "m2", order: 2, phase: 0, prerequisiteIds: ["m1"], sectionTitle: "Math" },
  { id: "h2", order: 3, phase: 0, prerequisiteIds: ["h1"], sectionTitle: "History" },
  { id: "m3", order: 4, phase: 0, prerequisiteIds: ["m2"], sectionTitle: "Math" },
  { id: "h3", order: 5, phase: 0, prerequisiteIds: ["h2"], sectionTitle: "History" },
];

const EXAM_ASKABLE = new Set(EXAM.map((skill) => skill.id));

function answer(
  skillId: string,
  outcome: PlacementEvidence["outcome"],
  format: PlacementEvidence["format"] = "multipleChoice",
): PlacementEvidence {
  return { format, outcome, skillId };
}

function place(evidence: PlacementEvidence[], skills = CHAIN) {
  const beliefs = getPlacementBeliefs({ evidence, skills });
  return { beliefs, phases: getPhaseStarts({ beliefs, skills }) };
}

describe(getPlacementBeliefs, () => {
  it("needs more than one lucky multiple-choice answer to be sure", () => {
    const { beliefs } = place([answer("c", "correct")]);

    expect(getSkillPlacementStatus(beliefs.get("c"))).toBe("unsure");
  });

  it("is sure after a typed answer confirms a right multiple-choice one", () => {
    const { beliefs } = place([answer("c", "correct"), answer("c", "correct", "typed")]);

    expect(getSkillPlacementStatus(beliefs.get("c"))).toBe("known");
    expect(getSkillPlacementStatus(beliefs.get("a"))).toBe("known");
    expect(getSkillPlacementStatus(beliefs.get("d"))).toBe("unsure");
  });

  it("treats a wrong answer or 'I don't know yet' as evidence against what builds on it", () => {
    const wrong = place([answer("b", "wrong")]);
    const dontKnow = place([answer("b", "dontKnow")]);

    expect(getSkillPlacementStatus(wrong.beliefs.get("b"))).toBe("unknown");
    expect(getSkillPlacementStatus(wrong.beliefs.get("e"))).toBe("unknown");
    expect(dontKnow.beliefs.get("e") ?? 1).toBeLessThan(wrong.beliefs.get("e") ?? 0);
    expect(getSkillPlacementStatus(wrong.beliefs.get("a"))).toBe("unsure");
  });

  it("ignores answers on skills outside the goal", () => {
    const { beliefs } = place([answer("elsewhere", "correct", "typed")]);

    expect([...beliefs.values()].every((belief) => belief === 0.5)).toBe(true);
  });
});

describe(getPhaseStarts, () => {
  it("isn't settled before any answer", () => {
    expect(place([]).phases.every((phase) => !phase.confident)).toBe(true);
  });

  it("settles every phase at its beginning after the first skill is unknown", () => {
    const { phases } = place([answer("a", "dontKnow")]);

    expect(phases).toStrictEqual([
      { confident: true, phase: 0, startSkillId: "a" },
      { confident: true, phase: 1, startSkillId: "d" },
    ]);
  });

  it("stops when every phase has a confident start, not after a set count", () => {
    const { phases } = place([
      answer("c", "correct"),
      answer("c", "correct", "typed"),
      answer("e", "wrong"),
      answer("d", "correct"),
      answer("d", "correct", "typed"),
    ]);

    expect(phases).toStrictEqual([
      { confident: true, phase: 0, startSkillId: null },
      { confident: true, phase: 1, startSkillId: "e" },
    ]);
  });
});

describe(chooseNextPlacementSkill, () => {
  it("starts in the middle of the plan", () => {
    expect(
      chooseNextPlacementSkill({
        askableSkillIds: ALL_ASKABLE,
        beliefs: place([]).beliefs,
        evidence: [],
        skills: CHAIN,
      }),
    ).toBe("c");
  });

  it("starts where the learner's own level points", () => {
    const beliefs = place([]).beliefs;

    expect(
      chooseNextPlacementSkill({
        askableSkillIds: ALL_ASKABLE,
        beliefs,
        evidence: [],
        ownLevel: "none",
        skills: CHAIN,
      }),
    ).toBe("a");

    expect(
      chooseNextPlacementSkill({
        askableSkillIds: ALL_ASKABLE,
        beliefs,
        evidence: [],
        ownLevel: "advanced",
        skills: CHAIN,
      }),
    ).toBe("d");
  });

  it("moves to harder skills after a right answer and to prerequisites after a wrong one", () => {
    const right = [answer("c", "correct"), answer("c", "correct", "typed")];
    const wrong = [answer("c", "wrong")];

    expect(
      chooseNextPlacementSkill({
        askableSkillIds: ALL_ASKABLE,
        beliefs: place(right).beliefs,
        evidence: right,
        skills: CHAIN,
      }),
    ).toBe("d");

    expect(
      chooseNextPlacementSkill({
        askableSkillIds: ALL_ASKABLE,
        beliefs: place(wrong).beliefs,
        evidence: wrong,
        skills: CHAIN,
      }),
    ).toBe("a");
  });

  it("asks nothing once placement is settled", () => {
    const evidence = [answer("a", "dontKnow")];

    expect(
      chooseNextPlacementSkill({
        askableSkillIds: ALL_ASKABLE,
        beliefs: place(evidence).beliefs,
        evidence,
        skills: CHAIN,
      }),
    ).toBeNull();
  });

  it("skips skills with no question to ask", () => {
    const askable = new Set(["a", "b", "d", "e"]);

    expect(
      chooseNextPlacementSkill({
        askableSkillIds: askable,
        beliefs: place([]).beliefs,
        evidence: [],
        skills: CHAIN,
      }),
    ).not.toBe("c");
  });
});

function nextFor(evidence: PlacementEvidence[], ownLevel: "basic" | "none" | null = null) {
  return chooseNextPlacementSkill({
    askableSkillIds: EXAM_ASKABLE,
    beliefs: place(evidence, EXAM).beliefs,
    evidence,
    ownLevel,
    skills: EXAM,
  });
}

function targetFor(evidence: PlacementEvidence[], skillId = "m2") {
  return getTargetDifficulty({ evidence, ownLevel: "basic", skillId, skills: EXAM });
}

describe("placement across an exam's areas", () => {
  it("samples every area before going deeper in one", () => {
    expect(nextFor([])).toBe("m2");
    expect(nextFor([answer("m2", "correct")])).toBe("h2");
    expect(nextFor([answer("m2", "correct"), answer("h2", "wrong")])).toBe("m3");
  });

  it("follows each area's own answers: harder after a right one, easier after a wrong one", () => {
    const evidence = [answer("m2", "correct"), answer("h2", "wrong"), answer("m3", "wrong")];

    // History has fewer answers, and its wrong h2 points to its prerequisite.
    expect(nextFor(evidence)).toBe("h1");
    // Math's last answer (m3) was wrong, so it goes back to what m3 builds on.
    expect(nextFor([...evidence, answer("h1", "dontKnow")])).toBe("m1");
  });

  it("starts each area where the learner's own level points", () => {
    expect(nextFor([], "none")).toBe("m1");
    expect(nextFor([answer("m1", "correct")], "none")).toBe("h1");
  });

  it("isn't settled until every area has a confident start", () => {
    const mathOnly = place([answer("m1", "dontKnow")], EXAM);

    expect(getAreaStarts({ beliefs: mathOnly.beliefs, skills: EXAM })).toStrictEqual([
      { area: "Math", confident: true, startSkillId: "m1" },
      { area: "History", confident: false, startSkillId: "h1" },
    ]);

    expect(mathOnly.phases).toStrictEqual([{ confident: false, phase: 0, startSkillId: "m1" }]);
    expect(isPlacementSettled({ beliefs: mathOnly.beliefs, skills: EXAM })).toBe(false);

    const both = place([answer("m1", "dontKnow"), answer("h1", "dontKnow")], EXAM);

    expect(isPlacementSettled({ beliefs: both.beliefs, skills: EXAM })).toBe(true);
  });

  it("has nothing to settle before the plan has skills", () => {
    expect(isPlacementSettled({ beliefs: new Map(), skills: [] })).toBe(false);
    expect(getAreaStarts({ beliefs: new Map(), skills: [] })).toStrictEqual([]);
  });
});

describe(getTargetDifficulty, () => {
  it("climbs after right answers and drops after wrong ones, area by area", () => {
    expect(targetFor([])).toBe(0);
    expect(targetFor([answer("m1", "correct")])).toBe(1);
    expect(targetFor([answer("m1", "correct"), answer("m2", "correct")])).toBe(2);
    expect(targetFor([answer("m1", "correct"), answer("m2", "wrong")])).toBe(0);
    expect(targetFor([answer("m1", "dontKnow")])).toBe(-1);
    expect(targetFor([answer("m1", "correct")], "h2")).toBe(0);
  });

  it("starts from the learner's own level and stays within the bank's range", () => {
    expect(
      getTargetDifficulty({ evidence: [], ownLevel: "none", skillId: "m1", skills: EXAM }),
    ).toBe(-1);

    const wrongs = Array.from({ length: 5 }, () => answer("m1", "wrong"));
    expect(targetFor(wrongs)).toBe(-2);
  });
});

describe(getScratchAreaStarts, () => {
  it("starts every area at its first skill", () => {
    expect(getScratchAreaStarts(EXAM)).toStrictEqual([
      { area: "Math", confident: true, startSkillId: "m1" },
      { area: "History", confident: true, startSkillId: "h1" },
    ]);
  });
});

describe(getScratchPhaseStarts, () => {
  it("starts every phase at its first skill", () => {
    expect(getScratchPhaseStarts(CHAIN)).toStrictEqual([
      { confident: true, phase: 0, startSkillId: "a" },
      { confident: true, phase: 1, startSkillId: "d" },
    ]);
  });
});

describe(pickPlacementItem, () => {
  const items = [
    { format: "multipleChoice" as const, id: "mc", seen: false, skillId: "c" },
    { format: "typed" as const, id: "typed", seen: false, skillId: "c" },
    { format: "trueFalse" as const, id: "seen", seen: true, skillId: "c" },
  ];

  it("covers breadth with a quick unseen question first", () => {
    expect(pickPlacementItem({ confirming: false, items, skillId: "c" })?.id).toBe("mc");
  });

  it("confirms a right answer with a question that is hard to guess", () => {
    expect(pickPlacementItem({ confirming: true, items, skillId: "c" })?.id).toBe("typed");
  });

  it("picks the question closest to the difficulty the learner is ready for", () => {
    const ladder = [
      { difficulty: -1, format: "multipleChoice" as const, id: "easy", seen: false, skillId: "c" },
      { difficulty: 0, format: "multipleChoice" as const, id: "medium", seen: false, skillId: "c" },
      { difficulty: 1, format: "multipleChoice" as const, id: "hard", seen: false, skillId: "c" },
    ];

    const pick = (targetDifficulty: number) =>
      pickPlacementItem({ confirming: false, items: ladder, skillId: "c", targetDifficulty })?.id;

    expect([pick(-1), pick(0), pick(2)]).toStrictEqual(["easy", "medium", "hard"]);
  });

  it("never repeats a question the learner has seen", () => {
    expect(
      pickPlacementItem({ confirming: false, items: items.slice(2), skillId: "c" }),
    ).toBeNull();
  });

  it("asks in the goal's quick format first, so shared questions in the other never win", () => {
    const both = [
      { difficulty: 0, format: "multipleChoice" as const, id: "mc", seen: false, skillId: "c" },
      { difficulty: 1, format: "trueFalse" as const, id: "tf", seen: false, skillId: "c" },
    ];

    const pick = (quickFormat: "multipleChoice" | "trueFalse") =>
      pickPlacementItem({ confirming: false, items: both, quickFormat, skillId: "c" })?.id;

    // The multiple-choice question is closer to the target difficulty, and still loses for an
    // exam that judges assertions right or wrong.
    expect([pick("trueFalse"), pick("multipleChoice")]).toStrictEqual(["tf", "mc"]);

    // Without a question that's hard to guess, a right answer is confirmed in the same order.
    expect(
      pickPlacementItem({ confirming: true, items: both, quickFormat: "trueFalse", skillId: "c" })
        ?.id,
    ).toBe("tf");
  });
});
