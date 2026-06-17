import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import {
  BookOpenIcon,
  BrainIcon,
  BriefcaseBusinessIcon,
  CompassIcon,
  GraduationCapIcon,
  LanguagesIcon,
  ListChecksIcon,
  type LucideIcon,
  RouteIcon,
  SparklesIcon,
  TargetIcon,
  TrendingUpIcon,
} from "lucide-react";
import { getExtracted } from "next-intl/server";
import Link from "next/link";
import { HeroTracker } from "./hero-tracker";

type LandingItem = {
  description: string;
  icon: LucideIcon;
  iconClassName: string;
  label?: string;
  title: string;
};

/**
 * Keeps each marketing section on the same quiet rhythm so the page can grow
 * beyond the hero without feeling like a separate, busier landing-page system.
 */
function LandingSection({ children, className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-14 md:py-20", className)}
      {...props}
    >
      {children}
    </section>
  );
}

/**
 * Centers section copy in a narrow measure because these blocks need to sell
 * one idea at a time before the supporting feature items appear.
 */
function LandingSectionHeader({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("mx-auto flex max-w-3xl flex-col gap-4 text-center", className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Reuses one spacious grid for both product benefits and use cases so the
 * repeated icon/text pattern feels intentional instead of decorative.
 */
function LandingItemGrid({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("grid gap-x-10 gap-y-12 md:grid-cols-2 lg:grid-cols-3", className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Presents one reason to believe in Zoonk without heavy card chrome. The icon
 * gives each idea a quick scanning anchor while the text carries the actual sale.
 */
function LandingItemCard({ item }: { item: LandingItem }) {
  const Icon = item.icon;

  return (
    <article className="flex flex-col gap-4">
      <div
        className={cn(
          "flex size-10 items-center justify-center rounded-full [&>svg]:size-5",
          item.iconClassName,
        )}
      >
        <Icon aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-foreground/90 text-base font-semibold tracking-tight">
            {item.title}
          </h3>

          {item.label && (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[0.6875rem] font-medium">
              {item.label}
            </span>
          )}
        </div>

        <p className="text-muted-foreground text-sm leading-6">{item.description}</p>
      </div>
    </article>
  );
}

/**
 * Keeps the first screen focused on aspiration and one action. The supporting
 * sections explain the problem and mechanism only after the user sees the outcome.
 */
async function HeroIntro() {
  const t = await getExtracted();

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8 px-4 py-16 text-center md:py-24">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-foreground/90 text-4xl font-semibold tracking-tight text-balance md:text-6xl">
          {t("Learn what matters")}
        </h1>

        <p className="text-muted-foreground text-lg leading-8 text-balance md:text-xl md:leading-9">
          {t(
            "Pass exams. Learn languages. Build skills. Land the job you want. Studying with Zoonk is simple, clear, and practical.",
          )}
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Link
          className={buttonVariants({ className: "gap-2", size: "lg", variant: "default" })}
          href="/learn"
          prefetch
        >
          <SparklesIcon aria-hidden="true" />
          {t("Start free")}
        </Link>

        <p className="text-muted-foreground flex flex-col items-center text-sm">
          <span>{t("No credit card required.")}</span>
          <span>{t("No commitment required.")}</span>
        </p>
      </div>
    </section>
  );
}

/**
 * Names the real learning pain before listing features, so the page sells the
 * cost of scattered learning instead of jumping straight into product mechanics.
 */
async function LearningProblemSection() {
  const t = await getExtracted();

  return (
    <LandingSection className="border-border/60 border-t">
      <LandingSectionHeader>
        <h2 className="text-foreground/90 text-2xl font-semibold tracking-tight text-balance md:text-4xl">
          {t("Why does studying feel so hard?")}
        </h2>

        <p className="text-muted-foreground text-base leading-8 text-balance md:text-lg">
          {t(
            "Too many lessons make simple ideas complicated. Too much studying turns into memorizing without understanding. And with videos, PDFs, notes, and AI chats everywhere, you still do not know where to start.",
          )}
        </p>

        <p className="text-foreground/80 text-base leading-8 text-balance md:text-lg">
          {t(
            "Zoonk keeps it simple: short lessons, plain language, everyday examples, quizzes, exercises, and real situations that help you understand the theory in practice.",
          )}
        </p>
      </LandingSectionHeader>
    </LandingSection>
  );
}

/**
 * Shows how the product fixes the learning problem using shipped capabilities:
 * path structure, clear explanations, active practice, visible progress, and continuity.
 */
async function SolutionSection() {
  const t = await getExtracted();

  const solutionItems: LandingItem[] = [
    {
      description: t(
        "Tell Zoonk your goal and follow one step at a time instead of juggling videos, PDFs, notes, and random chats.",
      ),
      icon: RouteIcon,
      iconClassName: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      title: t("A path, not a pile of tabs"),
    },
    {
      description: t(
        "Hard topics are broken down without jargon, fluff, or lectures that make simple ideas feel impossible.",
      ),
      icon: BookOpenIcon,
      iconClassName: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      title: t("Plain language, no academic noise"),
    },
    {
      description: t(
        "See how ideas show up in everyday situations, work problems, and decisions you actually need to make.",
      ),
      icon: CompassIcon,
      iconClassName: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      title: t("Real examples, not abstract theory"),
    },
    {
      description: t(
        "Use quizzes, exercises, examples, and scenarios to solve problems instead of just watching explanations.",
      ),
      icon: TargetIcon,
      iconClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      title: t("Practice that makes you think"),
    },
    {
      description: t(
        "See what you got right, what still needs work, and whether you are keeping a study rhythm, so you know what to do next.",
      ),
      icon: TrendingUpIcon,
      iconClassName: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
      title: t("Feedback that shows what to fix"),
    },
  ];

  return (
    <LandingSection>
      <LandingSectionHeader>
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {t("How Zoonk helps")}
        </p>

        <h2 className="text-foreground/90 text-2xl font-semibold tracking-tight text-balance md:text-4xl">
          {t("No boring lectures. No pointless memorizing.")}
        </h2>
      </LandingSectionHeader>

      <LandingItemGrid>
        {solutionItems.map((item) => (
          <LandingItemCard item={item} key={item.title} />
        ))}
      </LandingItemGrid>
    </LandingSection>
  );
}

/**
 * Separates available learning outcomes from upcoming promises so the page can
 * be ambitious without implying exams or personalization are already shipped.
 */
async function OpportunitySection() {
  const t = await getExtracted();

  const availableItems: LandingItem[] = [
    {
      description: t(
        "Learn 70 languages. See pronunciation in a way that makes sense in your language, so words click faster.",
      ),
      icon: LanguagesIcon,
      iconClassName: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
      title: t("Learn languages"),
    },
    {
      description: t(
        "Need a prerequisite for a course, project, or job? Build the skill with clear lessons and practical exercises.",
      ),
      icon: BrainIcon,
      iconClassName: "bg-lime-500/10 text-lime-700 dark:text-lime-400",
      title: t("Build skills"),
    },
    {
      description: t(
        "Stop hunting for the right video or PDF. Follow a course that explains, practices, and tracks your progress in one place.",
      ),
      icon: ListChecksIcon,
      iconClassName: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
      title: t("Follow guided courses"),
    },
  ];

  const comingSoonItems: LandingItem[] = [
    {
      description: t(
        "Prepare with a path that shows what to study, what is already strong, and what needs work, with simulations, quizzes, and practical explanations.",
      ),
      icon: GraduationCapIcon,
      iconClassName: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
      label: t("Soon"),
      title: t("Prepare for exams"),
    },
    {
      description: t(
        "A course focused on your goals, level, interests, hobbies, and real context, with examples that feel made for you.",
      ),
      icon: BriefcaseBusinessIcon,
      iconClassName: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
      label: t("Soon"),
      title: t("Personalized lessons"),
    },
  ];

  return (
    <LandingSection>
      <LandingSectionHeader>
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {t("Use Zoonk for what matters")}
        </p>

        <h2 className="text-foreground/90 text-2xl font-semibold tracking-tight text-balance md:text-4xl">
          {t("Start with the goal that matters now")}
        </h2>
      </LandingSectionHeader>

      <div className="flex flex-col gap-12">
        <div className="flex flex-col gap-6">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {t("Available now")}
          </p>

          <LandingItemGrid>
            {availableItems.map((item) => (
              <LandingItemCard item={item} key={item.title} />
            ))}
          </LandingItemGrid>
        </div>

        <div className="flex flex-col gap-6">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {t("Coming soon")}
          </p>

          <LandingItemGrid className="lg:grid-cols-2">
            {comingSoonItems.map((item) => (
              <LandingItemCard item={item} key={item.title} />
            ))}
          </LandingItemGrid>
        </div>
      </div>
    </LandingSection>
  );
}

/**
 * Shows the zero-progress home state for people who need a concrete reason to
 * start learning before they understand how Zoonk turns a goal into progress.
 */
export function Hero() {
  return (
    <main className="flex w-full flex-1 flex-col pb-12">
      <HeroTracker />
      <HeroIntro />
      <LearningProblemSection />
      <SolutionSection />
      <OpportunitySection />
    </main>
  );
}
