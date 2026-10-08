"use client";

import { getMenu } from "@/lib/menu";
import { type CatalogSearchResults } from "@zoonk/core/catalog/search";
import { useExtracted } from "next-intl";
import {
  type PaletteGroup,
  createChapterPaletteItem,
  createCoursePaletteItem,
  createExplanationPaletteItem,
  createFeedbackPaletteItem,
  createGoalPaletteItem,
  createLogoutPaletteItem,
  createNavigationPaletteItem,
  getVisiblePaletteGroups,
} from "./command-palette-items";

/**
 * What the learning tabs add to the palette: the learner's goals, so a goal can be switched from
 * the keyboard, and the host's action that saves the switch (as the goal switcher does); and their
 * quick explanations, newest first, each opening itself (finished ones are found here again).
 */
export type LearnerPalette = {
  activeGoalId: string | null;
  explanations: { id: string; title: string }[];
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

  /** The language setting lives in Appearance; its own entry lets "language" find it. */
  const language = createNavigationPaletteItem({
    id: "language",
    label: t("Language"),
    menu: getMenu("appearance"),
  });

  const accountItems = isLoggedIn
    ? [
        createNavigationPaletteItem({
          id: "profile",
          label: t("Profile"),
          menu: getMenu("profile"),
        }),
        createNavigationPaletteItem({
          id: "appearance",
          label: t("Appearance"),
          menu: getMenu("appearance"),
        }),
        language,
        createNavigationPaletteItem({ id: "memory", label: t("Memory"), menu: getMenu("memory") }),
        createNavigationPaletteItem({
          id: "subscription",
          label: t("Subscription"),
          menu: getMenu("subscription"),
        }),
        createLogoutPaletteItem({ label: t("Logout") }),
      ]
    : [
        createNavigationPaletteItem({ id: "login", label: t("Login"), menu: getMenu("login") }),
        language,
      ];

  const catalogPages: PaletteGroup = {
    id: "pages",
    items: [
      createNavigationPaletteItem({ id: "home", label: t("Home page"), menu: getMenu("home") }),
      createNavigationPaletteItem({ id: "courses", label: t("Courses"), menu: getMenu("courses") }),
      createNavigationPaletteItem({
        id: "start",
        label: t("Start a goal"),
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
            label: t("Help"),
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
 * The learning tabs' places, in the tabs' order, then the learner's other goals. Null outside the
 * learning tabs.
 */
function useLearnerPaletteGroups(learner?: LearnerPalette): PaletteGroup[] | null {
  const t = useExtracted();

  if (!learner) {
    return null;
  }

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
        createNavigationPaletteItem({ id: "today", label: t("Today"), menu: getMenu("today") }),
        createNavigationPaletteItem({
          id: "journey",
          label: t("Journey"),
          menu: getMenu("journey"),
        }),
        createNavigationPaletteItem({
          id: "buddy",
          label: t("Your buddy"),
          menu: getMenu("buddy"),
        }),
        createNavigationPaletteItem({
          id: "mistakes",
          label: t("Mistakes notebook"),
          menu: getMenu("mistakes"),
        }),
        createNavigationPaletteItem({
          id: "stats",
          label: t("Statistics"),
          menu: getMenu("stats"),
        }),
        createNavigationPaletteItem({
          id: "courses",
          label: t("Explore courses"),
          menu: getMenu("courses"),
        }),
        createNavigationPaletteItem({
          id: "start",
          label: t("Start a new goal"),
          menu: getMenu("start"),
        }),
      ],
      label: t("Pages"),
    },
    { id: "goals", items: goalItems, label: t("Goals") },
    {
      id: "explanations",
      items: learner.explanations.map(({ id, title }) =>
        createExplanationPaletteItem({ goalId: id, title }),
      ),
      label: t("Quick explanations"),
    },
  ];
}
