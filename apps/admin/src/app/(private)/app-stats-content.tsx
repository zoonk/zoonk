import { Stats } from "@/components/stats";
import { StatsSection } from "@/components/stats-section";
import { countCoursePrompts } from "@/data/course-prompts/list-course-prompts";
import { countLibraryContent } from "@/data/stats/count-library-content";
import { BookOpenIcon, LayersIcon, MessageSquareTextIcon, SparklesIcon } from "lucide-react";

/** The Library inventory and the course prompts learners submitted before goals replaced them. */
export async function ContentStats() {
  "use cache: private";

  const [content, promptCount] = await Promise.all([countLibraryContent(), countCoursePrompts()]);

  return (
    <StatsSection subtitle="Library catalog and review pipeline" title="Content & Operations">
      <Stats
        help="Courses with a Library outline"
        href="/stats/content?view=content-totals"
        icon={<BookOpenIcon />}
        title="Courses"
        value={content.courses.toLocaleString()}
      />

      <Stats
        help="Library chapters whose lesson outline is written"
        icon={<LayersIcon />}
        title="Chapters"
        value={content.chapters.toLocaleString()}
      />

      <Stats
        description={`${content.lessonOutlines.toLocaleString()} outlines`}
        help="Library lessons with generated content"
        icon={<LayersIcon />}
        title="Lessons"
        value={content.lessons.toLocaleString()}
      />

      <Stats
        help="All Library lesson screens"
        icon={<LayersIcon />}
        title="Steps"
        value={content.steps.toLocaleString()}
      />

      <Stats
        description={`${content.items.toLocaleString()} practice items`}
        help="Skills that weren't merged into another"
        href="/skills"
        icon={<SparklesIcon />}
        title="Skills"
        value={content.skills.toLocaleString()}
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
