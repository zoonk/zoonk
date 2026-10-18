import { describe, expect, it } from "vitest";
import { chooseBases } from "./base-choices";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { type PlannerLesson } from "./plan-units";

/** A Monday: the class test is ten days away. */
const TODAY = fromIsoDate("2026-10-12");
const AREA = "Biologia celular";

/** Pedro's cell biology notes: each skill with its lessons, its phase and its topic. */
const SPECS: [skillId: string, name: string, lessons: number, phase: number, topic: string][] = [
  ["theory", "Explicar a teoria celular", 2, 0, "Teoria celular"],
  ["prokaryotes", "Comparar células procariontes e eucariontes", 3, 0, "Procarionte x eucarionte"],
  ["membrane", "Explicar a membrana plasmática e o transporte", 5, 0, "Membrana plasmática"],
  ["osmosis", "Explicar a osmose em células", 5, 1, "Membrana plasmática"],
  ["organelles", "Relacionar organelas a funções celulares", 9, 1, "Organelas"],
  ["nucleus", "Descrever o núcleo celular", 2, 1, "Núcleo"],
  ["virus", "Explicar a natureza dos vírus", 3, 0, "Vírus"],
];

const SKILLS: PlanGraphSkill[] = SPECS.map(([skillId, name, lessons, phase, topic]) => ({
  area: AREA,
  lessons,
  name,
  phase,
  skillId,
  topics: [topic],
  weight: 3,
}));

/** Every skill's lessons but cell theory's, which the Library hasn't written yet. */
const LESSONS: PlannerLesson[] = SKILLS.filter((skill) => skill.skillId !== "theory").flatMap(
  (skill) =>
    Array.from({ length: skill.lessons }, (_, index) => ({
      chapterId: skill.skillId,
      lessonId: `${skill.skillId}-${index}`,
      minutes: 4,
      skillIds: [skill.skillId],
      title: `${skill.name} ${index + 1}`,
    })),
);

/**
 * At 45 minutes a day, studying prokaryotes (a base the organelles and the nucleus build on) in
 * depth. Placement missed cell theory, prokaryotes, the membrane, osmosis and the organelles, and
 * found that Pedro knows the viruses.
 */
const INPUT: BuildPlanInput = {
  announcements: ["Completar a tabela das organelas", "Dissertativa sobre osmose"],
  answeredWrongSkillIds: new Set(["theory", "prokaryotes", "membrane", "osmosis", "organelles"]),
  fullMockMinutes: 30,
  goal: { dailyMinutes: 45, kind: "exam", targetDate: addDays(TODAY, 10) },
  graph: {
    phases: [
      { milestone: null, name: "A célula e a membrana" },
      { milestone: null, name: "Organelas, núcleo e osmose" },
    ],
    skills: SKILLS,
  },
  items: [],
  knownSkillIds: new Set(["virus"]),
  lessons: LESSONS,
  missedSkillIds: new Set(["prokaryotes", "membrane", "organelles"]),
  mockMinutes: 15,
  mode: "forced",
  paceFactor: 1,
  prerequisites: new Map([
    ["osmosis", ["membrane"]],
    ["organelles", ["prokaryotes"]],
    ["nucleus", ["prokaryotes"]],
  ]),
  readiness: new Map(),
  settings: parsePlanSettings({
    baseChoices: [{ choice: "deep", skillId: "prokaryotes" }],
    shortMockMinutes: 30,
    startDate: toIsoDate(TODAY),
  }),
  today: TODAY,
  topicLevels: [{ level: "high", subject: AREA, topic: "Organelas" }],
};

/** The plan as the next run reads it: each item with its id and place. */
function save(plan: ReturnType<typeof buildPlan>) {
  return plan.items.map((item, position) => ({ ...item, id: item.id ?? `${position}`, position }));
}

function listLessonStatuses(plan: ReturnType<typeof buildPlan>, skillId: string): string[] {
  return plan.items.flatMap((item) =>
    item.kind === "lesson" && item.skillId === skillId ? [item.status] : [],
  );
}

// Class test seed 2087: a plan that studies a base another way follows the order of the plan with
// every base's core, and it carried the work earlier days left in without ranking it, so a topic
// placement had missed was set aside while the nucleus, which nobody missed, kept its lessons.
// Carried work ranks with the rest when time is short (R11).
describe("work earlier days left in a plan that studies a base another way", () => {
  it("keeps no lesson of a topic nobody missed once one the learner missed is set aside", () => {
    const made = save(buildPlan(chooseBases(INPUT).input));

    // Placement's right answers on the viruses tested their lessons out, and the plan was laid out
    // again without them.
    const testedOut = made.map((item) =>
      item.kind === "lesson" && item.skillId === "virus"
        ? { ...item, completedAt: TODAY, status: "testedOut" as const }
        : item,
    );

    const placed = buildPlan(chooseBases({ ...INPUT, items: testedOut }).input);

    const nucleusDays = placed.items.flatMap((item) =>
      item.kind === "lesson" && item.skillId === "nucleus" && item.scheduledFor
        ? [toIsoDate(item.scheduledFor)]
        : [],
    );

    expect(nucleusDays).toStrictEqual(["2026-10-16", "2026-10-16"]);

    // Five missed days later, the day's settling carries what they left: the nucleus too.
    const settled = buildPlan(
      chooseBases({
        ...INPUT,
        carryOver: { lessonIds: [] },
        items: save(placed),
        setAsideLeftWork: true,
        today: addDays(TODAY, 5),
      }).input,
    );

    expect(listLessonStatuses(settled, "theory")).toStrictEqual(["skipped"]);
    expect(listLessonStatuses(settled, "nucleus")).toStrictEqual(["skipped", "skipped"]);
  });
});
