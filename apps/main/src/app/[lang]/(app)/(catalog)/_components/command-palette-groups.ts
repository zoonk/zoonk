"use client";

import { getMenu } from "@/lib/menu";
import { useBuddyName } from "@zoonk/learn/buddy-name";
import { useExtracted } from "next-intl";
import {
  type PaletteGroup,
  createAskPaletteItem,
  createChapterPaletteItem,
  createCoursePaletteItem,
  createFeedbackPaletteItem,
  createLogoutPaletteItem,
  createMockPaletteItem,
  createNavigationPaletteItem,
  createPlanChapterPaletteItem,
  createStartGoalPaletteItem,
  createSubjectPaletteItem,
  getVisiblePaletteGroups,
  matchesPaletteSearch,
} from "./command-palette-items";
import { type LearnerPalette, useLearnerPaletteGroups } from "./command-palette-learner-groups";
import { useSettingsPaletteItems } from "./command-palette-settings";
import { type PaletteSearchResults } from "./search-courses-action";

const MAX_MOCK_RESULTS = 6;

/** A hook, because translated labels must be read with `t("literal")` at the render boundary. */
export function usePaletteGroups({
  isLoggedIn,
  learner,
  query,
  results,
}: {
  isLoggedIn: boolean;
  learner?: LearnerPalette;
  query: string;
  results: PaletteSearchResults;
}) {
  const t = useExtracted();
  const searching = query.trim().length > 0;
  const learnerGroups = useLearnerPaletteGroups({ learner, searching });
  const fallback = useFallbackGroup({ learner, query });

  const settings = useSettingsPaletteItems(isLoggedIn);
  const accountItems = isLoggedIn ? [createLogoutPaletteItem({ label: t("Logout") })] : [];

  const catalogPages: PaletteGroup = {
    id: "pages",
    items: [
      createNavigationPaletteItem({ id: "home", label: t("Home page"), menu: getMenu("home") }),
      createNavigationPaletteItem({
        id: "courses",
        label: t("Explore courses"),
        menu: getMenu("courses"),
      }),
      createNavigationPaletteItem({
        id: "start",
        label: t("Start a goal"),
        menu: getMenu("start"),
      }),
      ...(searching ? settings : []),
      ...(isLoggedIn
        ? []
        : [
            createNavigationPaletteItem({
              id: "pricing",
              label: t("Pricing"),
              menu: getMenu("pricing"),
            }),
            createNavigationPaletteItem({
              id: "login",
              label: t("Log in"),
              menu: getMenu("login"),
            }),
          ]),
    ],
    label: t("Go to"),
  };

  // A learner reaches their account and help pages from the avatar's menu: here they're found by name.
  const showsAccount = searching || !learner;

  const sendFeedback = createFeedbackPaletteItem({
    keywords: t({
      description:
        "Words people type to find Send feedback in the search, never shown. Keep “bug” and add the words people use in this language.",
      message: "bug, problem, report, idea, suggestion, feature request, contact",
    }),
    label: t("Send feedback"),
  });

  const helpItems = showsAccount
    ? [
        createNavigationPaletteItem({ id: "blog", label: t("Blog"), menu: getMenu("blog") }),
        sendFeedback,
        createNavigationPaletteItem({ id: "support", label: t("Help"), menu: getMenu("support") }),
      ]
    : [sendFeedback];

  const plan: PaletteGroup = {
    id: "plan",
    items: [
      ...results.plan.subjects.map((subject) => createSubjectPaletteItem(subject)),
      ...results.plan.chapters.map((chapter) => createPlanChapterPaletteItem(chapter)),
    ],
    label: t("Your plan"),
  };

  const groups = getVisiblePaletteGroups({
    groups: [
      ...(learnerGroups
        ? learnerGroups.map((group) =>
            group.id === "pages" && searching
              ? { ...group, items: [...group.items, ...settings] }
              : group,
          )
        : [catalogPages]),
      ...(showsAccount ? [{ id: "account", items: accountItems, label: t("My account") }] : []),
      { id: "help", items: helpItems, label: t("Help") },
    ],
    query,
  });

  // The server already matched these against the query, on more than their visible titles.
  const mocks = getVisiblePaletteGroups({
    groups: [
      {
        id: "mocks",
        items: results.mocks.map(({ blockId, number }) =>
          createMockPaletteItem({
            blockId,
            label: t("Mock exam {number}", { number: String(number) }),
          }),
        ),
        label: t("Mock exams"),
      },
    ],
    query,
  }).map((group) => ({ ...group, items: group.items.slice(0, MAX_MOCK_RESULTS) }));

  const catalogItems = [
    ...results.catalog.courses.map((course) => createCoursePaletteItem(course)),
    ...results.catalog.chapters.map((chapter) => createChapterPaletteItem(chapter)),
  ].toSorted(
    (left, right) =>
      Number(matchesPaletteSearch({ query, value: right.label })) -
      Number(matchesPaletteSearch({ query, value: left.label })),
  );

  const searched: PaletteGroup[] = [
    plan,
    ...mocks,
    { id: "catalog", items: catalogItems, label: t("In the catalog") },
  ].filter((group) => group.items.length > 0);

  return [...placeSearched({ groups, searched }), ...(fallback ? [fallback] : [])];
}

function placeSearched({
  groups,
  searched,
}: {
  groups: PaletteGroup[];
  searched: PaletteGroup[];
}): PaletteGroup[] {
  const firstGeneral = groups.findIndex((group) => group.id === "account" || group.id === "help");

  if (firstGeneral === -1) {
    return [...groups, ...searched];
  }

  return [...groups.slice(0, firstGeneral), ...searched, ...groups.slice(firstGeneral)];
}

function useFallbackGroup({
  learner,
  query,
}: {
  learner?: LearnerPalette;
  query: string;
}): PaletteGroup | null {
  const t = useExtracted();
  const buddy = useBuddyName(learner?.buddy ?? null);
  const question = query.trim();

  if (!question) {
    return null;
  }

  const ask = learner?.canAskBuddy
    ? createAskPaletteItem({
        label: t("Ask {buddy}: “{question}”", { buddy, question }),
        meta: t("opens the chat"),
        question,
      })
    : null;

  const startGoal = createStartGoalPaletteItem({
    label: learner
      ? t("Start a new goal: “{goal}”", { goal: question })
      : t("Start a goal: “{goal}”", { goal: question }),
    prompt: question,
  });

  return {
    id: "fallback",
    items: ask ? [ask, startGoal] : [startGoal],
    label: ask
      ? t({
          description: "Heading over the option to ask the buddy the typed question.",
          message: "Ask",
        })
      : t("New goal"),
  };
}
