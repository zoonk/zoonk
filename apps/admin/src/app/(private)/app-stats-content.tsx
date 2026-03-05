import { Stats } from "@/components/stats";
import { StatsSection } from "@/components/stats-section";
import { countContent } from "@/data/stats/count-content";
import { countCourses } from "@/data/stats/count-courses";
import { countTotalPendingReviews } from "@/data/stats/count-total-pending-reviews";
import { AlertCircleIcon, BookOpenIcon, LayersIcon } from "lucide-react";
import { connection } from "next/server";

export async function ContentStats() {
  await connection();

  const [totalCourses, content, pendingReviews] = await Promise.all([
    countCourses(),
    countContent(),
    countTotalPendingReviews(),
  ]);

  return (
    <StatsSection subtitle="Content catalog and review pipeline" title="Content & Operations">
      <Stats
        help="Published and draft courses"
        href="/courses"
        icon={<BookOpenIcon />}
        title="Courses"
        value={totalCourses.toLocaleString()}
      />

      <Stats
        help="Total chapter count"
        icon={<LayersIcon />}
        title="Chapters"
        value={content.chapters.toLocaleString()}
      />

      <Stats
        help="Total lesson count"
        icon={<LayersIcon />}
        title="Lessons"
        value={content.lessons.toLocaleString()}
      />

      <Stats
        help="Total activity count"
        icon={<LayersIcon />}
        title="Activities"
        value={content.activities.toLocaleString()}
      />

      <Stats
        help="Total step count"
        icon={<LayersIcon />}
        title="Steps"
        value={content.steps.toLocaleString()}
      />

      <Stats
        help="Content awaiting admin review"
        href="/review"
        icon={<AlertCircleIcon />}
        title="Pending Reviews"
        value={pendingReviews.toLocaleString()}
      />
    </StatsSection>
  );
}
