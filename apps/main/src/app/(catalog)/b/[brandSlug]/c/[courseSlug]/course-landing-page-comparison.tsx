import { Tabs, TabsContent, TabsList, TabsTrigger } from "@zoonk/ui/components/tabs";
import { BrainCircuitIcon, type LucideIcon, MousePointerClickIcon, RouteIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { TraditionalLearningMock, ZoonkLearningMock } from "./course-landing-page-comparison-mocks";

export type TeachingComparisonItem = {
  icon: LucideIcon;
  id: TeachingComparisonId;
  label: string;
  mockKind: TeachingComparisonMockKind;
  options: string[];
  traditional: string;
  traditionalMeta: string;
  zoonk: string;
  zoonkMeta: string;
};

type TeachingComparisonId = "check" | "explain" | "try";

type TeachingComparisonMockKind = "example" | "scenario" | "transfer";

export type TeachingComparisonContent = {
  heading: string;
  items: TeachingComparisonItem[];
  traditionalLabel: string;
  zoonkLabel: string;
};

/**
 * Shows the teaching method as a compact product demo. Each tab is a format
 * comparison: a passive artifact on the left and the Zoonk learning moment on
 * the right.
 */
export async function CourseLandingTeachingComparison() {
  const t = await getExtracted();

  const content: TeachingComparisonContent = {
    heading: t("Abstract ideas get a real situation"),
    items: [
      {
        icon: BrainCircuitIcon,
        id: "explain",
        label: t({
          description:
            "Short imperative verb label for the first tab in a learning flow: understand, practice, then test. Translate as an action the learner takes, not as a noun.",
          id: "courseLandingComparisonUnderstandTab",
          message: "Understand",
        }),
        mockKind: "example",
        options: [],
        traditional: t("Gravity is the force that attracts objects with mass toward one another."),
        traditionalMeta: t("2h 47m video"),
        zoonk: t("It's why your coffee falls when you knock over the mug."),
        zoonkMeta: t("Short and practical lessons"),
      },
      {
        icon: RouteIcon,
        id: "try",
        label: t({
          description:
            "Short imperative verb label for the second tab in a learning flow: understand, practice, then test. Translate as an action the learner takes, not as a noun.",
          id: "courseLandingComparisonPracticeTab",
          message: "Practice",
        }),
        mockKind: "scenario",
        options: [t("Prices rise"), t("Prices stay flat"), t("Demand disappears")],
        traditional: t("Supply and demand determine prices. Define supply, then define demand."),
        traditionalMeta: t("Worksheet"),
        zoonk: t(
          "A concert has 300 seats and 1,200 people waiting. What happens to ticket prices if no more seats are added?",
        ),
        zoonkMeta: t("Solve a problem"),
      },
      {
        icon: MousePointerClickIcon,
        id: "check",
        label: t({
          description:
            "Short imperative verb label for the third tab in a learning flow: understand, practice, then test. Translate as an action the learner takes, not as a noun.",
          id: "courseLandingComparisonTestTab",
          message: "Test",
        }),
        mockKind: "transfer",
        options: [t("Inertia"), t("Gravity"), t("Friction")],
        traditional: t("What is inertia?"),
        traditionalMeta: t("Recall quiz"),
        zoonk: t("When a car brakes suddenly, everyone leans forward. What's making that happen?"),
        zoonkMeta: t("Practical example"),
      },
    ],
    traditionalLabel: t("Typical course"),
    zoonkLabel: t("Zoonk lesson"),
  };

  return <TeachingComparison content={content} />;
}

/**
 * Places the lesson modes between the headline and the comparison cards so the
 * section reads top-down on mobile and desktop. The shared tabs primitive owns
 * keyboard behavior while the comparison cards remain server-rendered content.
 */
function TeachingComparison({ content }: { content: TeachingComparisonContent }) {
  return (
    <section>
      <div className="bg-muted/30 relative rounded-lg p-4 sm:p-6 md:p-8">
        <Tabs className="gap-5" defaultValue={content.items[0]?.id}>
          <h2 className="w-full text-3xl leading-tight font-semibold text-balance sm:text-4xl">
            {content.heading}
          </h2>

          <TabsList
            aria-label={content.heading}
            className="bg-background/80 grid h-auto w-full grid-cols-3 gap-1 rounded-lg p-1 group-data-horizontal/tabs:h-auto sm:w-fit sm:min-w-96"
          >
            {content.items.map((item) => (
              <TeachingComparisonTab item={item} key={item.id} />
            ))}
          </TabsList>

          <div className="relative">
            {content.items.map((item) => (
              <TeachingComparisonPanel content={content} item={item} key={item.id} />
            ))}
          </div>
        </Tabs>
      </div>
    </section>
  );
}

/**
 * Wraps the shared tab trigger with the high-contrast active treatment this
 * product demo needs. The labels stay short verbs so the three modes fit in one
 * row on mobile.
 */
function TeachingComparisonTab({ item }: { item: TeachingComparisonItem }) {
  const Icon = item.icon;

  return (
    <TabsTrigger
      className="data-active:bg-info h-10 rounded-md border-0 px-2 text-sm data-active:text-white data-active:shadow-sm sm:h-11 sm:px-3"
      value={item.id}
    >
      <Icon aria-hidden="true" className="size-4" />
      <span>{item.label}</span>
    </TabsTrigger>
  );
}

/**
 * Renders one comparison demo. The traditional and Zoonk sides use the same
 * content topic but different formats, which makes the contrast visible.
 */
function TeachingComparisonPanel({
  content,
  item,
}: {
  content: TeachingComparisonContent;
  item: TeachingComparisonItem;
}) {
  return (
    <TabsContent className="text-base" value={item.id}>
      <div className="grid gap-3 md:grid-cols-[0.92fr_1.08fr]">
        <TraditionalLearningMock content={content} item={item} />
        <ZoonkLearningMock content={content} item={item} />
      </div>
    </TabsContent>
  );
}
