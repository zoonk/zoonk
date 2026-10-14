import { describe, expect, it } from "vitest";
import { checkChallengeAfterLessons } from "./challenge-rules";
import {
  ruleContext,
  ruleDay,
  ruleEventItem,
  ruleLesson,
  rulePhase,
  rulePhaseDatesProposal,
  rulePlan,
  ruleSkill,
} from "./rule-fixtures";

/** A lesson of `texto` (6 lessons, a core of 2) on a day, filed under a phase. */
function textoLesson(day: number, phase = 0) {
  return ruleLesson({ day, lessonId: `texto-${day}`, phase, skillId: "texto" });
}

/** Phase 0's challenge on a day. */
function challengeOn(day: number) {
  return ruleEventItem({ day, kind: "boss", phase: 0 });
}

/** Today's proposal to move phase 0's end past its lesson, saying so when `lessonsFirst`. */
function moveFirstEnd({
  lessonsFirst,
  status,
}: {
  lessonsFirst: boolean;
  status: "declined" | "proposed";
}) {
  return rulePhaseDatesProposal({
    effect: {
      phaseEnds: [
        {
          after: ruleDay(6).toISOString().slice(0, 10),
          before: ruleDay(4).toISOString().slice(0, 10),
          ...(lessonsFirst && { lessonsFirst: true as const }),
          name: "learn",
        },
      ],
    },
    status,
  });
}

/** A learn phase with a name of its own, as the Plan shows it. */
function namedPhase({ end, name, start }: { end: number; name: string; start: number }) {
  return { ...rulePhase({ end, start }), name };
}

/** Today's proposal to move "Arrival"'s end from day 4 to day 5, saying so when `lessonsFirst`. */
function moveArrival({
  lessonsFirst,
  status,
}: {
  lessonsFirst: boolean;
  status: "declined" | "proposed";
}) {
  return rulePhaseDatesProposal({
    effect: {
      phaseEnds: [
        {
          after: ruleDay(5).toISOString().slice(0, 10),
          before: ruleDay(4).toISOString().slice(0, 10),
          ...(lessonsFirst && { lessonsFirst: true as const }),
          name: "Arrival",
        },
      ],
    },
    status,
  });
}

/** The lesson of `fluxos` at a place in its chapter, on a day. */
function fluxosLesson(day: number, index: number) {
  return ruleLesson({ day, lessonId: `fluxos-${index}`, skillId: "fluxos" });
}

/** A lesson of `tarde` on a day, filed under a phase. */
function tardeLesson(day: number, phase: number) {
  return ruleLesson({ day, lessonId: `tarde-${day}`, phase, skillId: "tarde" });
}

/** `fluxos` with this size: two lessons before phase 0's challenge on day 4, a third on day 20. */
function fluxosPlan(skill: Parameters<typeof ruleSkill>[0]) {
  return rulePlan({
    items: [fluxosLesson(1, 0), fluxosLesson(2, 1), challengeOn(4), fluxosLesson(20, 2)],
    phases: [rulePhase({ end: 4, start: 0 }), rulePhase({ end: 10, start: 5 })],
    skills: [ruleSkill(skill)],
  });
}

describe("R40 a phase's challenge comes after its own lessons", () => {
  // `texto` has 6 lessons, so its first 2 in the plan are its core; `redes` is taught in phase 1.
  const r40Skills = [
    ruleSkill({ lessons: 6, skillId: "texto" }),
    ruleSkill({ phase: 1, skillId: "redes" }),
  ];

  const examPhases = [
    rulePhase({ end: 4, kind: "foundations", start: 0 }),
    rulePhase({ end: 10, kind: "gaps", start: 5 }),
  ];

  const learnPhases = [rulePhase({ end: 4, start: 0 }), rulePhase({ end: 10, start: 5 })];

  it("passes a challenge after the core of its lessons, with depth after it", () => {
    const after = rulePlan({
      items: [textoLesson(1), textoLesson(2), challengeOn(4), textoLesson(6)],
      phases: examPhases,
      skills: r40Skills,
    });

    expect(checkChallengeAfterLessons(ruleContext({ after }))).toStrictEqual([]);
  });

  it("flags a challenge due before core lessons of its own phase (IELTS seed 1011)", () => {
    const after = rulePlan({
      items: [textoLesson(1), challengeOn(2), textoLesson(3)],
      phases: examPhases,
      skills: r40Skills,
    });

    expect(checkChallengeAfterLessons(ruleContext({ after }))).toMatchObject([
      { details: { lastLesson: ruleDay(3).toISOString().slice(0, 10), later: 1, phase: 0 } },
    ]);
  });

  describe("in an exam's time-boxed windows", () => {
    // `tarde` (6 lessons, a core of 2) begins on the window's last study day: its core ends in the
    // next window.
    const skills = [...r40Skills, ruleSkill({ lessons: 6, skillId: "tarde" })];

    it("passes a challenge that leaves a skill begun late in its window to a later one", () => {
      const after = rulePlan({
        items: [
          textoLesson(1),
          textoLesson(2),
          tardeLesson(3, 0),
          challengeOn(4),
          tardeLesson(6, 1),
        ],
        phases: examPhases,
        skills,
      });

      expect(checkChallengeAfterLessons(ruleContext({ after }))).toStrictEqual([]);
    });

    it("flags one that, with every skill of its window late, asks what was begun by its day", () => {
      const after = rulePlan({
        items: [tardeLesson(3, 0), challengeOn(4), tardeLesson(6, 1)],
        phases: examPhases,
        skills,
      });

      expect(checkChallengeAfterLessons(ruleContext({ after }))).toMatchObject([
        { details: { skills: ["tarde"] }, rule: "R40" },
      ]);
    });
  });

  it("reads the lessons of the skills a challenge asks wherever the plan dated them (career seed 1027)", () => {
    // `texto`'s first lesson is in phase 0, so phase 0's challenge asks it; the plan filed its
    // second core lesson, which no longer fit before phase 0's end, under phase 1's time.
    const after = rulePlan({
      items: [textoLesson(1), challengeOn(4), textoLesson(6, 1)],
      phases: learnPhases,
      skills: r40Skills,
    });

    expect(checkChallengeAfterLessons(ruleContext({ after }))).toMatchObject([
      { details: { later: 1, phase: 0 }, rule: "R40" },
    ]);
  });

  it("holds a learn phase's challenge to its own skills' lessons filed under the next phase (career seed 1027)", () => {
    // No lesson of phase 1's `redes` (3 lessons, a core of 1) fit before phase 1's kept end, so the
    // plan filed them all under phase 2's time, after phase 1's challenge.
    const after = rulePlan({
      items: [
        textoLesson(1),
        textoLesson(2),
        challengeOn(4),
        ruleEventItem({ day: 5, kind: "boss", phase: 1 }),
        ruleLesson({ day: 6, phase: 2, skillId: "redes" }),
        ruleLesson({ day: 7, phase: 2, skillId: "redes" }),
        ruleEventItem({ day: 12, kind: "boss", phase: 2 }),
      ],
      phases: [
        rulePhase({ end: 4, start: 0 }),
        rulePhase({ end: 5, start: 5 }),
        rulePhase({ end: 12, start: 6 }),
      ],
      skills: r40Skills,
    });

    expect(checkChallengeAfterLessons(ruleContext({ after }))).toMatchObject([
      { details: { later: 1, phase: 1, skills: ["redes"] }, rule: "R40" },
    ]);
  });

  it("reads an exam's time-boxed phase by the window a skill starts in, not its graph phase", () => {
    // `texto` sits in the graph's first phase, but this exam plan studies it in its second window,
    // so the second window's challenge asks it.
    const after = rulePlan({
      items: [
        challengeOn(4),
        textoLesson(6, 1),
        textoLesson(7, 1),
        ruleEventItem({ day: 9, kind: "boss", phase: 1 }),
      ],
      phases: examPhases,
      skills: r40Skills,
    });

    expect(checkChallengeAfterLessons(ruleContext({ after }))).toStrictEqual([]);
  });

  it("counts a skill's core by the lessons the plan's build counted, not the graph's estimate (career seed 2050)", () => {
    // The graph guessed 7 lessons for `fluxos` (a core of 3), but the build counted 6 in its
    // chapter (a core of 2), so its third lesson is depth the plan may study after the challenge.
    expect(
      checkChallengeAfterLessons(
        ruleContext({ after: fluxosPlan({ lessons: 7, skillId: "fluxos" }) }),
      ),
    ).toMatchObject([{ details: { later: 1 }, rule: "R40" }]);

    expect(
      checkChallengeAfterLessons(
        ruleContext({ after: fluxosPlan({ lessons: 7, plannedLessons: 6, skillId: "fluxos" }) }),
      ),
    ).toStrictEqual([]);
  });

  it("counts a stand-in at the lessons it plans toward a skill's core", () => {
    // `texto`'s core is 2 lessons: a stand-in for 2 holds it all, so the lesson after it is depth.
    const after = rulePlan({
      items: [
        ruleLesson({ day: 1, lessonId: null, lessons: 2, skillId: "texto" }),
        challengeOn(4),
        textoLesson(6),
      ],
      phases: learnPhases,
      skills: r40Skills,
    });

    expect(checkChallengeAfterLessons(ruleContext({ after }))).toStrictEqual([]);
  });

  describe("with a skill heard only through recordings", () => {
    // `escuta` is practiced only with recordings: a challenge with written questions can't ask it.
    const learner = { listeningSkillIds: ["escuta"] };

    it("leaves it out of a challenge that asks other skills (IELTS seed 1107)", () => {
      const after = rulePlan({
        items: [
          textoLesson(1),
          textoLesson(2),
          challengeOn(4),
          ruleLesson({ day: 6, skillId: "escuta" }),
        ],
        phases: learnPhases,
        skills: [...r40Skills, ruleSkill({ skillId: "escuta" })],
      });

      expect(checkChallengeAfterLessons(ruleContext({ after, learner }))).toStrictEqual([]);
    });

    it("holds a challenge of recordings alone to its lessons", () => {
      const after = rulePlan({
        items: [challengeOn(4), ruleLesson({ day: 6, skillId: "escuta" })],
        phases: learnPhases,
        skills: [ruleSkill({ skillId: "escuta" }), ruleSkill({ phase: 1, skillId: "texto" })],
      });

      expect(checkChallengeAfterLessons(ruleContext({ after, learner }))).toMatchObject([
        { details: { skills: ["escuta"] }, rule: "R40" },
      ]);
    });
  });

  describe("a challenge held on the end the learner saw", () => {
    const after = rulePlan({
      items: [textoLesson(1), challengeOn(4), textoLesson(6, 1)],
      phases: learnPhases,
      skills: r40Skills,
    });

    it("passes it while Today asks to move that end, or after Keep mine on a card that said its lessons come after it", () => {
      const waiting = [moveFirstEnd({ lessonsFirst: false, status: "proposed" })];
      const declined = [moveFirstEnd({ lessonsFirst: true, status: "declined" })];

      expect(checkChallengeAfterLessons(ruleContext({ after, waiting }))).toStrictEqual([]);
      expect(checkChallengeAfterLessons(ruleContext({ after, declined }))).toStrictEqual([]);
    });

    it("passes later challenges whose lessons spill over from that end while Today asks to move it, or after Keep mine (language seeds 2 and 2090)", () => {
      const spilled = rulePlan({
        items: [
          textoLesson(1),
          challengeOn(4),
          textoLesson(5, 1),
          ruleEventItem({ day: 10, kind: "boss", phase: 1 }),
          ruleLesson({ day: 11, lessonId: "redes-11", phase: 2, skillId: "redes" }),
        ],
        phases: [
          namedPhase({ end: 4, name: "Arrival", start: 0 }),
          namedPhase({ end: 10, name: "Renting", start: 5 }),
          namedPhase({ end: 20, name: "Work", start: 11 }),
        ],
        skills: r40Skills,
      });

      const flagsRenting = [{ details: { phase: 1 }, rule: "R40" }];

      expect(
        checkChallengeAfterLessons(
          ruleContext({
            after: spilled,
            waiting: [moveArrival({ lessonsFirst: true, status: "proposed" })],
          }),
        ),
      ).toStrictEqual([]);

      expect(
        checkChallengeAfterLessons(
          ruleContext({
            after: spilled,
            waiting: [moveArrival({ lessonsFirst: false, status: "proposed" })],
          }),
        ),
      ).toMatchObject(flagsRenting);

      expect(
        checkChallengeAfterLessons(
          ruleContext({
            after: spilled,
            declined: [moveArrival({ lessonsFirst: true, status: "declined" })],
          }),
        ),
      ).toStrictEqual([]);

      expect(
        checkChallengeAfterLessons(
          ruleContext({
            after: spilled,
            declined: [moveArrival({ lessonsFirst: false, status: "declined" })],
          }),
        ),
      ).toMatchObject([{ details: { phase: 0 } }, { details: { phase: 1 } }]);
    });

    it("flags it after Keep mine on a card that didn't say so", () => {
      const declined = [moveFirstEnd({ lessonsFirst: false, status: "declined" })];

      expect(checkChallengeAfterLessons(ruleContext({ after, declined }))).toMatchObject([
        { details: { later: 1, phase: 0 }, rule: "R40" },
      ]);
    });
  });
});
