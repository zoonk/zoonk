import { getLearnerMilestoneSummary } from "@/data/stats/get-learner-milestones";
import {
  DEFAULT_COMPLETED_LESSONS_THRESHOLD,
  DEFAULT_LEARNING_DAYS_THRESHOLD,
  type LearnerMilestoneKind,
  buildLearnerMilestoneUsersHref,
  getLearnerMilestoneCopy,
  parseLearnerMilestoneThreshold,
} from "@/lib/learner-milestone-filters";
import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { BookCheckIcon, CalendarDaysIcon } from "lucide-react";
import Form from "next/form";
import Link from "next/link";

type EngagementSearchParams = {
  completedLessons?: string | string[];
  learningDays?: string | string[];
  view?: string | string[];
};

/**
 * Learner milestones are all-time threshold questions, so they live as a quiet
 * engagement subsection with URL-backed inputs and linked counts.
 */
export function LearnerMilestones({ searchParams }: { searchParams: EngagementSearchParams }) {
  const completedLessonsThreshold = parseLearnerMilestoneThreshold({
    defaultValue: DEFAULT_COMPLETED_LESSONS_THRESHOLD,
    value: searchParams.completedLessons,
  });

  const learningDaysThreshold = parseLearnerMilestoneThreshold({
    defaultValue: DEFAULT_LEARNING_DAYS_THRESHOLD,
    value: searchParams.learningDays,
  });

  return (
    <CachedLearnerMilestones
      completedLessonsThreshold={completedLessonsThreshold}
      learningDaysThreshold={learningDaysThreshold}
    />
  );
}

/**
 * Parsed thresholds and scalar period state provide deterministic private-cache
 * keys while keeping the milestone result available before navigation.
 */
async function CachedLearnerMilestones({
  completedLessonsThreshold,
  learningDaysThreshold,
}: {
  completedLessonsThreshold: number;
  learningDaysThreshold: number;
}) {
  "use cache: private";

  const summary = await getLearnerMilestoneSummary(
    completedLessonsThreshold,
    learningDaysThreshold,
  );

  return (
    <section className="flex flex-col gap-8 py-4">
      <LearnerMilestoneForm
        completedLessonsThreshold={completedLessonsThreshold}
        learningDaysThreshold={learningDaysThreshold}
      />

      <div className="border-border/60 grid grid-cols-1 divide-y border-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <LearnerMilestoneCard
          count={summary.completedLessonsUsers}
          icon={<BookCheckIcon />}
          kind="completedLessons"
          threshold={completedLessonsThreshold}
        />

        <LearnerMilestoneCard
          count={summary.learningDaysUsers}
          icon={<CalendarDaysIcon />}
          kind="learningDays"
          threshold={learningDaysThreshold}
        />
      </div>
    </section>
  );
}

/**
 * The threshold form updates the engagement page with a plain GET request, so
 * admins can bookmark or share the exact thresholds they are inspecting.
 */
function LearnerMilestoneForm({
  completedLessonsThreshold,
  learningDaysThreshold,
}: {
  completedLessonsThreshold: number;
  learningDaysThreshold: number;
}) {
  return (
    <Form action="/stats/engagement" className="flex flex-col gap-5">
      <p className="text-muted-foreground max-w-2xl text-sm">
        All-time learner counts for completion depth and return days. Adjust either threshold to
        explore a different milestone.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input name="view" type="hidden" value="learner-milestones" />

        <MilestoneThresholdField
          defaultValue={completedLessonsThreshold}
          id="completed-lessons-threshold"
          label="Completed lessons"
          name="completedLessons"
        />

        <MilestoneThresholdField
          defaultValue={learningDaysThreshold}
          id="learning-days-threshold"
          label="Learning days"
          name="learningDays"
        />

        <Button className="self-start sm:self-auto" type="submit" variant="outline">
          Apply thresholds
        </Button>
      </div>
    </Form>
  );
}

/**
 * Threshold inputs share bounds and layout, but each writes to a different
 * query key so both milestone questions can be tuned independently.
 */
function MilestoneThresholdField({
  defaultValue,
  id,
  label,
  name,
}: {
  defaultValue: number;
  id: string;
  label: string;
  name: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        defaultValue={defaultValue}
        id={id}
        key={defaultValue}
        min={1}
        name={name}
        type="number"
      />
    </div>
  );
}

/**
 * The linked card is the bridge from "how many?" to "who are they?" while
 * keeping the visual treatment consistent with the rest of the stats page.
 */
function LearnerMilestoneCard({
  count,
  icon,
  kind,
  threshold,
}: {
  count: number;
  icon: React.ReactNode;
  kind: LearnerMilestoneKind;
  threshold: number;
}) {
  const copy = getLearnerMilestoneCopy({ kind, threshold });

  return (
    <Link
      className="hover:bg-muted/40 flex min-w-0 flex-col gap-3 px-2 py-8 transition-colors sm:px-8"
      href={buildLearnerMilestoneUsersHref({ kind, threshold })}
      prefetch
    >
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <span className="flex size-4 items-center justify-center">{icon}</span>
        <span>{copy.pageTitle}</span>
      </div>
      <p className="text-5xl leading-none font-semibold tracking-tight tabular-nums">
        {count.toLocaleString()}
      </p>
      <p className="text-muted-foreground text-sm">{copy.help}</p>
      <span className="text-sm font-medium">Open user list →</span>
    </Link>
  );
}

/**
 * The milestone section fetches independently from the period metrics, so its
 * skeleton mirrors only the threshold controls and two linked counts.
 */
export function LearnerMilestonesSkeleton() {
  return (
    <section className="flex flex-col gap-8 py-4">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-96 max-w-full" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-16 flex-1 rounded-lg" />
          <Skeleton className="h-16 flex-1 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-4xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </section>
  );
}
