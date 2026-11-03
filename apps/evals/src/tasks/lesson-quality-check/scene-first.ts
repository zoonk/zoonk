import { type LessonScreen, type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";

type Recorded = { lesson: WrittenLesson; spec: LessonSpec };

type SceneFirstPlan = {
  /** The hook's brief for the scene. */
  brief: string;
  picture: string | null;
  /** The recorded plan's screens, in the lesson's new order after the scene. */
  order: readonly number[];
  /** Screens that change with the new order, by index in the recorded plan. */
  changes?: Readonly<Record<number, Partial<LessonScreen>>>;
};

type Opening = {
  scene: Extract<WrittenScreen, { kind: "hookText" }>;
  /** The recorded screens, in their new order after the scene. */
  order: readonly number[];
  /** Screens that change with the new order, by index in the recorded lesson. */
  rewrites?: Readonly<Record<number, WrittenScreen>>;
  /** Omitted when the recorded plan already opens on the scene. */
  plan?: SceneFirstPlan;
};

function toGuessPlan(screen: LessonScreen): LessonScreen {
  return screen.kind === "hook" ? { ...screen, kind: "guess", skills: [0] } : screen;
}

function reorderPlan({ plan, spec }: { plan: SceneFirstPlan; spec: LessonSpec }): LessonSpec {
  const scene: LessonScreen = {
    activityTemplate: null,
    brief: plan.brief,
    kind: "hook",
    skills: [],
    visual: plan.picture,
    visualKind: plan.picture ? "picture" : "none",
  };

  const screens = plan.order.map((index) => {
    const screen = spec.screens[index];

    if (!screen) {
      throw new Error(`The recorded plan has no screen ${index}.`);
    }

    return toGuessPlan({ ...screen, ...plan.changes?.[index] });
  });

  return { ...spec, screens: [scene, ...screens] };
}

function moveBasis(screen: WrittenScreen, order: readonly number[]): WrittenScreen {
  if (!("basis" in screen) || !screen.basis) {
    return screen;
  }

  return {
    ...screen,
    basis: { ...screen.basis, screen: order.indexOf(screen.basis.screen - 1) + 2 },
  };
}

/**
 * Lessons recorded before every lesson opened on a scene: the scene goes first, the guess moves
 * right after the first explanation, a check asked before teaching moves after it, and each check's
 * basis follows the screen it quotes.
 */
export function openOnScene<T extends Recorded>(recorded: T, opening: Opening): T {
  const screens = opening.order.map((index) => {
    const screen = opening.rewrites?.[index] ?? recorded.lesson.screens[index];

    if (!screen) {
      throw new Error(`The recorded lesson has no screen ${index}.`);
    }

    return moveBasis(screen, opening.order);
  });

  return {
    ...recorded,
    lesson: { ...recorded.lesson, screens: [opening.scene, ...screens] },
    spec: opening.plan ? reorderPlan({ plan: opening.plan, spec: recorded.spec }) : recorded.spec,
  };
}
