import { stepGenerateCourseAlternativeTitles } from "./steps/step-generate-course-alternative-titles";
import { stepGenerateCourseCategories } from "./steps/step-generate-course-categories";
import { stepGenerateCourseChapters } from "./steps/step-generate-course-chapters";
import { stepGenerateCourseDescription } from "./steps/step-generate-course-description";
import { stepGenerateCourseThumbnail } from "./steps/step-generate-course-thumbnail";
import { stepGenerateFirstChapterLessons } from "./steps/step-generate-first-chapter-lessons";
import { stepUpdateGeneratedCourse } from "./steps/step-update-generated-course";

export type CourseGenerationParams = {
  courseId: number;
  courseSuggestionId: number;
  title: string;
  locale: string;
};

export async function courseGenerationWorkflow(params: CourseGenerationParams) {
  "use workflow";

  // Run metadata generation in parallel
  const [description, categories, alternatives, chapters, thumbnail] =
    await Promise.all([
      stepGenerateCourseDescription({
        locale: params.locale,
        title: params.title,
      }),
      stepGenerateCourseCategories({ courseTitle: params.title }),
      stepGenerateCourseAlternativeTitles({
        locale: params.locale,
        title: params.title,
      }),
      stepGenerateCourseChapters({
        courseTitle: params.title,
        locale: params.locale,
      }),
      stepGenerateCourseThumbnail({ title: params.title }),
    ]);

  // Update the course with generated content
  const course = await stepUpdateGeneratedCourse({
    alternativeTitles: alternatives.data,
    categories: categories.data,
    chapters: chapters.data,
    courseId: params.courseId,
    description: description.data,
    locale: params.locale,
    thumbnailUrl: thumbnail.url,
  });

  // Generate lessons for first chapter
  const firstChapter = course.chapters[0];
  if (firstChapter) {
    await stepGenerateFirstChapterLessons({
      chapter: {
        description: firstChapter.description,
        id: firstChapter.id,
        title: firstChapter.title,
      },
      courseTitle: params.title,
      locale: params.locale,
    });
  }

  return { courseSlug: course.slug };
}
