import { cn } from "@zoonk/ui/lib/utils";
import {
  BadgeInfoIcon,
  BookOpenTextIcon,
  CheckCircle2Icon,
  HeadphonesIcon,
  LanguagesIcon,
  LightbulbIcon,
  ListChecksIcon,
  type LucideIcon,
  MessageCircleIcon,
  WrenchIcon,
} from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ComponentProps } from "react";

export type CourseLandingListItems = [string, ...string[]];

type CourseLandingMethodItem = { description: string; icon: LucideIcon; title: string };

/**
 * The main promise deserves more space than the supporting lists. This section
 * uses generated outcomes as proof points without making the page feel like a
 * dense course syllabus.
 */
export async function CourseLandingOutcomes({ items }: { items: CourseLandingListItems }) {
  const t = await getExtracted();

  return (
    <CourseLandingPanelSection>
      <CourseLandingPanelHeader>
        <CourseLandingPanelTitle>{t("What you'll learn")}</CourseLandingPanelTitle>
      </CourseLandingPanelHeader>

      <CourseLandingList>
        {items.map((item) => (
          <CourseLandingListItem key={item}>{item}</CourseLandingListItem>
        ))}
      </CourseLandingList>
    </CourseLandingPanelSection>
  );
}

/**
 * The generated audience copy deserves the same calm hierarchy as outcomes, so
 * prospective learners can answer "is this for me?" without reading a second
 * dense marketing block.
 */
export async function CourseLandingAudience({ items }: { items: string[] }) {
  const t = await getExtracted();
  const audienceItems = [t("Curious beginners who want to see if the subject clicks"), ...items];

  return (
    <CourseLandingPanelSection>
      <CourseLandingPanelHeader>
        <CourseLandingPanelTitle>{t("Who this course is for")}</CourseLandingPanelTitle>
      </CourseLandingPanelHeader>

      <CourseLandingList>
        {audienceItems.map((item) => (
          <CourseLandingListItem key={item}>{item}</CourseLandingListItem>
        ))}
      </CourseLandingList>
    </CourseLandingPanelSection>
  );
}

/**
 * Opportunities are a separate decision from audience fit. Keeping them in the
 * shared list-section shape makes the tabs feel like one system instead of
 * three unrelated content treatments.
 */
export async function CourseLandingOpportunities({ items }: { items: CourseLandingListItems }) {
  const t = await getExtracted();

  return (
    <CourseLandingPanelSection>
      <CourseLandingPanelHeader>
        <CourseLandingPanelTitle>{t("Where you'll use it")}</CourseLandingPanelTitle>
      </CourseLandingPanelHeader>

      <CourseLandingList>
        {items.map((item) => (
          <CourseLandingListItem key={item}>{item}</CourseLandingListItem>
        ))}
      </CourseLandingList>
    </CourseLandingPanelSection>
  );
}

/**
 * Decision panels share one vertical section frame so the active tab always
 * starts with the same title rhythm and the body content gets the full panel
 * width. Each child component still owns exactly one element, which keeps the
 * layout flexible without prop-heavy section APIs.
 */
function CourseLandingPanelSection({ children, className }: ComponentProps<"section">) {
  return (
    <section
      className={cn("grid w-full gap-7", className)}
      data-slot="course-landing-panel-section"
    >
      {children}
    </section>
  );
}

/**
 * The panel header is separated from the title so future tabs can add small
 * metadata beside the heading without changing the section component.
 */
function CourseLandingPanelHeader({ children, className }: ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-2", className)} data-slot="course-landing-panel-header">
      {children}
    </div>
  );
}

/**
 * This heading scale is shared by every decision panel so no tab looks more
 * important just because it uses a different body layout.
 */
export function CourseLandingPanelTitle({ children, className }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "max-w-3xl text-3xl leading-tight font-semibold tracking-normal text-balance sm:text-4xl",
        className,
      )}
      data-slot="course-landing-panel-title"
    >
      {children}
    </h2>
  );
}

/**
 * A two-column list gives generated bullets enough room without turning the
 * panel into a vertical wall. The list stays a real `ul` for accessibility and
 * scanability.
 */
function CourseLandingList({ children, className }: ComponentProps<"ul">) {
  return (
    <ul
      className={cn("grid gap-x-10 gap-y-7 md:grid-cols-2", className)}
      data-slot="course-landing-list"
    >
      {children}
    </ul>
  );
}

/**
 * Every generated persuasion item uses the same check marker so outcomes, fit,
 * and uses read as comparable proof points instead of separate content genres.
 */
function CourseLandingListItem({ children, className }: ComponentProps<"li">) {
  return (
    <li
      className={cn("grid grid-cols-[1rem_1fr] items-start gap-3.5", className)}
      data-slot="course-landing-list-item"
    >
      <CheckCircle2Icon aria-hidden="true" className="text-info mt-1.5 size-4 shrink-0" />
      <span className="text-muted-foreground text-base leading-7 text-pretty">{children}</span>
    </li>
  );
}

/**
 * This static product section explains the course structure without relying on
 * generated marketing copy. Language courses need their own version because
 * they are built around language skills instead of general concept transfer.
 */
export async function CourseLandingMethodSection({
  isLanguageCourse,
}: {
  isLanguageCourse: boolean;
}) {
  const t = await getExtracted();

  const methodItems: CourseLandingMethodItem[] = isLanguageCourse
    ? [
        {
          description: t("Learn useful words, then practice them until they become natural."),
          icon: LanguagesIcon,
          title: t("Vocabulary"),
        },
        {
          description: t("Read short, everyday texts that show how the language is actually used."),
          icon: BookOpenTextIcon,
          title: t("Reading"),
        },
        {
          description: t(
            "Listen to real-life situations and train your ear to understand naturally.",
          ),
          icon: HeadphonesIcon,
          title: t("Listening"),
        },
        {
          description: t("Understand grammar rules through simple explanations."),
          icon: LightbulbIcon,
          title: t("Grammar"),
        },
        {
          description: t(
            "Learn pronunciation by comparing sounds to your own language (e.g. Hola → OH-lah)",
          ),
          icon: MessageCircleIcon,
          title: t("Pronunciation"),
        },
      ]
    : [
        {
          description: t("Complex ideas explained in simple language."),
          icon: MessageCircleIcon,
          title: t("Everyday language"),
        },
        {
          description: t("See how each concept appears in everyday situations."),
          icon: LightbulbIcon,
          title: t("Real-life examples"),
        },
        {
          description: t("Apply what you learn to realistic situations, not just definitions."),
          icon: WrenchIcon,
          title: t("Practice with real problems"),
        },
        {
          description: t("Practice what you learned with a few quick questions."),
          icon: ListChecksIcon,
          title: t("Quiz"),
        },
      ];

  return (
    <CourseLandingPanelSection>
      <CourseLandingPanelHeader>
        <CourseLandingPanelTitle>{t("How our lessons work")}</CourseLandingPanelTitle>
      </CourseLandingPanelHeader>

      <ul className="grid gap-x-10 gap-y-8 md:grid-cols-2">
        {methodItems.map((item) => {
          const Icon = item.icon;

          return (
            <li className="flex gap-4" key={item.title}>
              <span className="bg-info/10 text-info flex size-9 shrink-0 items-center justify-center rounded-md">
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <span className="flex flex-col gap-2">
                <span className="font-medium">{item.title}</span>
                <span className="text-muted-foreground text-sm leading-6 text-pretty">
                  {item.description}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </CourseLandingPanelSection>
  );
}

/**
 * The credential note prevents overclaiming while staying secondary to the
 * course path. It is intentionally small because it clarifies expectations
 * without turning the landing page into legal copy.
 */
export async function CourseLandingCredentialNote() {
  const t = await getExtracted();

  return (
    <section className="mx-auto w-full max-w-4xl">
      <div className="bg-muted/40 flex gap-4 rounded-lg p-5">
        <span className="bg-info/10 text-info flex size-9 shrink-0 items-center justify-center rounded-md">
          <BadgeInfoIcon aria-hidden="true" className="size-4" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">{t("A course, not a credential")}</h2>
          <p className="text-muted-foreground text-sm leading-6 text-pretty">
            {t(
              "The goal of this course is to help you understand the subject and develop useful skills. It does not grant a college degree, professional license, or other officially recognized qualification.",
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
