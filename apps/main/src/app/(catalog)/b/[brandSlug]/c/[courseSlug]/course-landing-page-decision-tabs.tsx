import { type CourseChapter } from "@/data/chapters/list-course-chapters";
import { HorizontalScroll } from "@zoonk/ui/components/horizontal-scroll";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@zoonk/ui/components/tabs";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { CourseLandingTeachingComparison } from "./course-landing-page-comparison";
import { CourseLandingCurriculum } from "./course-landing-page-curriculum";
import { COURSE_LANDING_FRAME_CLASS_NAME } from "./course-landing-page-layout";
import {
  CourseLandingAudience,
  CourseLandingCredentialNote,
  CourseLandingMethodSection,
  CourseLandingOpportunities,
  CourseLandingOutcomes,
} from "./course-landing-page-sections";

type CourseLandingDecisionId = "audience" | "content" | "method" | "outcomes" | "uses";

type CourseLandingDecisionPanel = {
  content: ReactNode;
  id: CourseLandingDecisionId;
  label: string;
};

/**
 * The landing page should answer one visitor question at a time. This keeps the
 * full generated course story available, while the default view stays focused
 * on the first decision a new learner makes: is this course worth trying?
 */
export async function CourseLandingDecisionTabs({
  audience,
  chapters,
  isLanguageCourse,
  opportunities,
  outcomes,
  showCredentialNote,
}: {
  audience: string[];
  chapters: CourseChapter[];
  isLanguageCourse: boolean;
  opportunities: string[];
  outcomes: string[];
  showCredentialNote: boolean;
}) {
  const t = await getExtracted();

  const methodPanel: CourseLandingDecisionPanel = {
    content: (
      <div className="grid gap-12">
        <CourseLandingMethodSection isLanguageCourse={isLanguageCourse} />
        {!isLanguageCourse && <CourseLandingTeachingComparison />}
      </div>
    ),
    id: "method",
    label: t("How"),
  };

  const contentPanel: CourseLandingDecisionPanel = {
    content: (
      <div className="mx-auto grid w-full max-w-3xl gap-10">
        <CourseLandingCurriculum chapters={chapters} />
        {showCredentialNote && <CourseLandingCredentialNote />}
      </div>
    ),
    id: "content",
    label: t("Content"),
  };

  const panels: CourseLandingDecisionPanel[] = isLanguageCourse
    ? [methodPanel, contentPanel]
    : [
        { content: <CourseLandingOutcomes items={outcomes} />, id: "outcomes", label: t("What") },
        { content: <CourseLandingAudience items={audience} />, id: "audience", label: t("Who") },
        {
          content: <CourseLandingOpportunities items={opportunities} />,
          id: "uses",
          label: t("Where"),
        },
        methodPanel,
        contentPanel,
      ];

  return (
    <section className={cn(COURSE_LANDING_FRAME_CLASS_NAME, "px-4 py-3 lg:py-6")}>
      <Tabs className="gap-0" defaultValue={panels[0]?.id}>
        <div className="bg-background/95 supports-backdrop-filter:bg-background/75 sticky top-18 z-30 rounded-lg border p-1 backdrop-blur-md lg:top-20">
          <HorizontalScroll>
            <TabsList
              aria-label={t("Course questions")}
              className={cn(
                "flex h-auto w-max min-w-full gap-1 overflow-y-hidden rounded-none bg-transparent p-0 group-data-horizontal/tabs:h-auto sm:grid sm:w-full",
                getDecisionGridClassName({ panelCount: panels.length }),
              )}
            >
              {panels.map((panel) => (
                <CourseLandingDecisionTab key={panel.id} panel={panel} />
              ))}
            </TabsList>
          </HorizontalScroll>
        </div>

        <div className="pt-8 lg:pt-10">
          {panels.map((panel) => (
            <CourseLandingDecisionPanelView key={panel.id} panel={panel} />
          ))}
        </div>
      </Tabs>
    </section>
  );
}

/**
 * Keeps the sticky tab grid balanced when language courses have two panels and
 * general courses have five. The strings stay explicit so Tailwind can emit
 * both grid variants.
 */
function getDecisionGridClassName({ panelCount }: { panelCount: number }) {
  return panelCount === 2 ? "sm:grid-cols-2" : "sm:grid-cols-5";
}

/**
 * Wraps the shared tab trigger with landing-page sizing. The underlying tabs
 * primitive owns keyboard behavior and selected state, while this component
 * keeps the course-specific control compact on mobile.
 */
function CourseLandingDecisionTab({ panel }: { panel: CourseLandingDecisionPanel }) {
  return (
    <TabsTrigger
      className={cn(
        "data-active:bg-foreground data-active:text-background h-9 min-w-24 shrink-0 rounded-md border-0 p-2 text-center text-sm whitespace-nowrap sm:min-w-0",
      )}
      value={panel.id}
    >
      {panel.label}
    </TabsTrigger>
  );
}

/**
 * Renders server-built panel content inside the shared Tabs boundary. Next can
 * pass Server Components through Client Component slots, so generated course
 * sections stay server-rendered while tab selection hydrates only the shell.
 */
function CourseLandingDecisionPanelView({ panel }: { panel: CourseLandingDecisionPanel }) {
  return (
    <TabsContent className="text-base" value={panel.id}>
      {panel.content}
    </TabsContent>
  );
}
