import { STAT_TILES_CLASS, StatTile, StatTileSkeleton } from "@/components/stat-tile";
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
import { BookCheckIcon, BookOpenIcon, CalendarDaysIcon, UsersIcon } from "lucide-react";
import Form from "next/form";

type EngagementSearchParams = {
  completedLessons?: string | string[];
  learningDays?: string | string[];
  view?: string | string[];
};

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

/** Primitive props make each threshold its own cache entry. */
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
      <div className={STAT_TILES_CLASS}>
        <StatTile
          detail="Accounts, all time"
          href="/users"
          icon={<UsersIcon />}
          title="Total users"
          value={summary.totalUsers.toLocaleString("en")}
        />

        <StatTile
          detail="Average, among learners who finished one"
          icon={<BookOpenIcon />}
          title="Lessons per learner"
          value={summary.lessonsPerLearner.toLocaleString("en", { maximumFractionDigits: 1 })}
        />

        <LearnerMilestoneTile
          count={summary.completedLessonsUsers}
          icon={<BookCheckIcon />}
          kind="completedLessons"
          threshold={completedLessonsThreshold}
        />

        <LearnerMilestoneTile
          count={summary.learningDaysUsers}
          icon={<CalendarDaysIcon />}
          kind="learningDays"
          threshold={learningDaysThreshold}
        />
      </div>

      <LearnerMilestoneForm
        completedLessonsThreshold={completedLessonsThreshold}
        learningDaysThreshold={learningDaysThreshold}
      />
    </section>
  );
}

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
        Change a milestone to count the learners who reached another.
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

        <Button className="self-start sm:self-auto" size="lg" type="submit" variant="outline">
          Apply thresholds
        </Button>
      </div>
    </Form>
  );
}

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

/** How many learners reached a milestone; the tile opens the list of them. */
function LearnerMilestoneTile({
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
    <StatTile
      detail="Learners, all time"
      help={copy.help}
      href={buildLearnerMilestoneUsersHref({ kind, threshold })}
      icon={icon}
      title={copy.pageTitle}
      value={count.toLocaleString("en")}
    />
  );
}

export function LearnerMilestonesSkeleton() {
  return (
    <section className="flex flex-col gap-8 py-4">
      <div className={STAT_TILES_CLASS}>
        <StatTileSkeleton />
        <StatTileSkeleton />
        <StatTileSkeleton />
        <StatTileSkeleton />
      </div>

      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-96 max-w-full" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-16 flex-1 rounded-lg" />
          <Skeleton className="h-16 flex-1 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-4xl" />
        </div>
      </div>
    </section>
  );
}
