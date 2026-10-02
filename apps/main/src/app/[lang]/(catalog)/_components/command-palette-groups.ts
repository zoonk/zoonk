"use client";

import { getMenu } from "@/lib/menu";
import { type CatalogSearchResults } from "@zoonk/core/catalog/search";
import { useOptionalExperienceMode } from "@zoonk/learn/mode";
import { useExtracted } from "next-intl";
import {
  type PaletteGroup,
  createChapterPaletteItem,
  createCoursePaletteItem,
  createFeedbackPaletteItem,
  createGoalPaletteItem,
  createLogoutPaletteItem,
  createNavigationPaletteItem,
  getVisiblePaletteGroups,
} from "./command-palette-items";

/**
 * What the learning tabs add to the palette: the learner's goals, so a goal can be switched from
 * the keyboard, and the host's action that saves the switch (as the goal switcher does).
 */
export type LearnerPalette = {
  activeGoalId: string | null;
  goals: { id: string; title: string }[];
  onSwitchGoal: (goalId: string) => Promise<void>;
};

/**
 * Palette groups are assembled in a hook because translated labels must be read
 * with `t("literal")` at the render boundary, not passed through a translation
 * helper or stored outside the component.
 */
export function usePaletteGroups({
  isLoggedIn,
  learner,
  query,
  results,
}: {
  isLoggedIn: boolean;
  learner?: LearnerPalette;
  query: string;
  results: CatalogSearchResults;
}) {
  const t = useExtracted();
  const learnerGroups = useLearnerPaletteGroups(learner);

  const accountItems = isLoggedIn
    ? [
        createNavigationPaletteItem({
          id: "my-courses",
          label: t("My courses"),
          menu: getMenu("myCourses"),
        }),
        createNavigationPaletteItem({
          id: "subscription",
          label: t("Manage subscription"),
          menu: getMenu("subscription"),
        }),
        createNavigationPaletteItem({
          id: "update-language",
          label: t("Update language"),
          menu: getMenu("language"),
        }),
        createNavigationPaletteItem({
          id: "profile",
          label: t("Update profile"),
          menu: getMenu("profile"),
        }),
        createNavigationPaletteItem({
          id: "appearance",
          label: t("Appearance"),
          menu: getMenu("appearance"),
        }),
        createNavigationPaletteItem({ id: "memory", label: t("Memory"), menu: getMenu("memory") }),
        createLogoutPaletteItem({ label: t("Logout") }),
      ]
    : [
        createNavigationPaletteItem({ id: "login", label: t("Login"), menu: getMenu("login") }),
        createNavigationPaletteItem({
          id: "language",
          label: t("Language"),
          menu: getMenu("language"),
        }),
      ];

  const catalogPages: PaletteGroup = {
    id: "pages",
    items: [
      createNavigationPaletteItem({ id: "home", label: t("Home page"), menu: getMenu("home") }),
      createNavigationPaletteItem({ id: "courses", label: t("Courses"), menu: getMenu("courses") }),
      createNavigationPaletteItem({
        id: "start",
        label: t("Start a new course"),
        menu: getMenu("start"),
      }),
    ],
    label: t("Pages"),
  };

  return getVisiblePaletteGroups({
    groups: [
      ...(learnerGroups ?? [catalogPages]),
      { id: "account", items: accountItems, label: t("My account") },
      {
        id: "help",
        items: [
          createNavigationPaletteItem({ id: "blog", label: t("Blog"), menu: getMenu("blog") }),
          createFeedbackPaletteItem({ label: t("Send feedback") }),
          createNavigationPaletteItem({
            id: "support",
            label: t("Feedback & Support"),
            menu: getMenu("support"),
          }),
        ],
        label: t("Help"),
      },
      { id: "courses", items: results.courses.map(createCoursePaletteItem), label: t("Courses") },
      {
        id: "chapters",
        items: results.chapters.map(createChapterPaletteItem),
        label: t("Chapters"),
      },
    ],
    query,
  });
}

/**
 * The learning tabs' places in the names the learner's mode uses (Fun's Route, Cards and buddy,
 * as on the dock), then the learner's other goals. Null outside the learning tabs.
 */
function useLearnerPaletteGroups(learner?: LearnerPalette): PaletteGroup[] | null {
  const t = useExtracted();
  const isFun = useOptionalExperienceMode() === "fun";

  if (!learner) {
    return null;
  }

  const today = createNavigationPaletteItem({
    id: "today",
    label: t("Today"),
    menu: getMenu("today"),
  });

  const progress = createNavigationPaletteItem({
    id: "progress",
    label: t("Progress"),
    menu: getMenu("progress"),
  });

  const modePages = isFun
    ? [
        today,
        createNavigationPaletteItem({ id: "plan", label: t("Route"), menu: getMenu("plan") }),
        createNavigationPaletteItem({ id: "content", label: t("Cards"), menu: getMenu("content") }),
        createNavigationPaletteItem({
          id: "buddy",
          label: t("Your buddy"),
          menu: getMenu("buddy"),
        }),
        progress,
        createNavigationPaletteItem({
          id: "logbook",
          label: t("Logbook"),
          menu: getMenu("logbook"),
        }),
      ]
    : [
        today,
        createNavigationPaletteItem({ id: "plan", label: t("Plan"), menu: getMenu("plan") }),
        progress,
        createNavigationPaletteItem({
          id: "content",
          label: t("Content"),
          menu: getMenu("content"),
        }),
      ];

  /** The goal switcher falls back to the first goal when none is saved as active yet. */
  const activeGoalId = learner.activeGoalId ?? learner.goals[0]?.id;

  const goalItems = learner.goals
    .filter((goal) => goal.id !== activeGoalId)
    .map((goal) =>
      createGoalPaletteItem({
        goalId: goal.id,
        label: t("Switch to {goal}", { goal: goal.title }),
      }),
    );

  return [
    {
      id: "pages",
      items: [
        ...modePages,
        createNavigationPaletteItem({
          id: "mistakes",
          label: t("Mistakes notebook"),
          menu: getMenu("mistakes"),
        }),
        createNavigationPaletteItem({
          id: "courses",
          label: t("Explore courses"),
          menu: getMenu("courses"),
        }),
        createNavigationPaletteItem({
          id: "start",
          label: t("Add a goal"),
          menu: getMenu("start"),
        }),
      ],
      label: t("Pages"),
    },
    { id: "goals", items: goalItems, label: t("Goals") },
  ];
}
