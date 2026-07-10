import { Stats } from "@/components/stats";
import { StatsSection } from "@/components/stats-section";
import { countCoursePrompts } from "@/data/course-prompts/list-course-prompts";
import { countContent } from "@/data/stats/count-content";
import { countCourses } from "@/data/stats/count-courses";
import { BookOpenIcon, LayersIcon, MessageSquareTextIcon } from "lucide-react";
import { connection } from "next/server";

export async function ContentStats() {
  await connection();

  const [totalCourses, content, promptCount] = await Promise.all([
    countCourses(),
    countContent(),
    countCoursePrompts(),
  ]);

  return (
    <StatsSection subtitle="Content catalog and review pipeline" title="Content & Operations">
      <Stats
        help="All courses, including published and draft courses"
        href="/courses"
        icon={<BookOpenIcon />}
        title="Courses"
        value={totalCourses.toLocaleString()}
      />

      <Stats
        help="Chapters with completed generation status"
        icon={<LayersIcon />}
        title="Chapters"
        value={content.chapters.toLocaleString()}
      />

      <Stats
        help="Lessons with completed generation status"
        icon={<LayersIcon />}
        title="Lessons"
        value={content.lessons.toLocaleString()}
      />

      <Stats
        help="All generated step rows"
        icon={<LayersIcon />}
        title="Steps"
        value={content.steps.toLocaleString()}
      />

      <Stats
        help="Course prompts submitted by learners"
        href="/course-prompts"
        icon={<MessageSquareTextIcon />}
        title="Course Prompts"
        value={promptCount.toLocaleString()}
      />
    </StatsSection>
  );
}
