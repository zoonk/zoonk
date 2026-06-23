import { Stats } from "@/components/stats";
import { StatsSection } from "@/components/stats-section";
import { countCourseStartRequests } from "@/data/course-start-requests/list-course-start-requests";
import { countContent } from "@/data/stats/count-content";
import { countCourses } from "@/data/stats/count-courses";
import { BookOpenIcon, LayersIcon, MessageSquareTextIcon } from "lucide-react";
import { connection } from "next/server";

export async function ContentStats() {
  await connection();

  const [totalCourses, content, requestCount] = await Promise.all([
    countCourses(),
    countContent(),
    countCourseStartRequests(),
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
        help="Total step count"
        icon={<LayersIcon />}
        title="Steps"
        value={content.steps.toLocaleString()}
      />

      <Stats
        help="Course start requests submitted by learners"
        href="/course-start-requests"
        icon={<MessageSquareTextIcon />}
        title="Course Starts"
        value={requestCount.toLocaleString()}
      />
    </StatsSection>
  );
}
