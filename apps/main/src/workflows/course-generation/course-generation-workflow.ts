import { getWorkflowMetadata } from "workflow";

import { addAlternativeTitlesStep } from "./steps/add-alternative-titles-step";
import { addCategoriesStep } from "./steps/add-categories-step";
import { addChaptersStep } from "./steps/add-chapters-step";
import { checkCourseExistsStep } from "./steps/check-course-exists-step";
import { cleanupFailedCourseStep } from "./steps/cleanup-failed-course-step";
import { createCourseStep } from "./steps/create-course-step";
import { createRunStep } from "./steps/create-run-step";
import { generateAlternativeTitlesStep } from "./steps/generate-alternative-titles-step";
import { generateCategoriesStep } from "./steps/generate-categories-step";
import { generateChaptersStep } from "./steps/generate-chapters-step";
import { generateDescriptionStep } from "./steps/generate-description-step";
import { generateImageStep } from "./steps/generate-image-step";
import { generateLessonsStep } from "./steps/generate-lessons-step";
import { getCourseSuggestionStep } from "./steps/get-course-suggestion-step";
import { updateCourseStep } from "./steps/update-course-step";
import { updateRunStatusStep } from "./steps/update-run-status-step";
import { updateStatusStep } from "./steps/update-status-step";

export type CourseGenerationInput = {
  courseSuggestionId: number;
  courseTitle: string;
};

export type CourseGenerationResult = {
  courseId: number;
  status: "completed" | "already_exists" | "failed";
  slug: string;
};

export async function courseGenerationWorkflow(
  input: CourseGenerationInput,
): Promise<CourseGenerationResult> {
  "use workflow";

  const { courseSuggestionId, courseTitle } = input;
  const { workflowRunId: runId } = getWorkflowMetadata();

  const [, suggestion] = await Promise.all([
    createRunStep({
      courseSuggestionId,
      runId,
      title: courseTitle,
    }),
    getCourseSuggestionStep({
      id: courseSuggestionId,
      title: courseTitle,
    }),
  ]);

  const existingCourse = await checkCourseExistsStep({
    locale: suggestion.locale,
    title: courseTitle,
  });

  if (existingCourse) {
    if (existingCourse.generationStatus !== "completed") {
      await updateStatusStep({
        courseId: existingCourse.id,
        status: "completed",
      });
    }

    await updateRunStatusStep({
      courseId: existingCourse.id,
      runId,
      status: "completed",
    });

    return {
      courseId: existingCourse.id,
      slug: existingCourse.slug,
      status: "already_exists",
    };
  }

  await cleanupFailedCourseStep({
    locale: suggestion.locale,
    title: courseTitle,
  });

  const course = await createCourseStep({
    locale: suggestion.locale,
    title: courseTitle,
  });

  try {
    const [description, imageUrl, alternativeTitles, categories, chapters] =
      await Promise.all([
        generateDescriptionStep({
          locale: suggestion.locale,
          title: courseTitle,
        }),
        generateImageStep({ title: courseTitle }),
        generateAlternativeTitlesStep({
          locale: suggestion.locale,
          title: courseTitle,
        }),
        generateCategoriesStep({ courseTitle }),
        generateChaptersStep({
          courseTitle,
          locale: suggestion.locale,
        }),
      ]);

    await Promise.all([
      updateCourseStep({
        courseId: course.id,
        description,
        imageUrl,
        status: "completed",
      }),
      addAlternativeTitlesStep({
        courseId: course.id,
        locale: suggestion.locale,
        titles: alternativeTitles,
      }),
      addCategoriesStep({
        categories,
        courseId: course.id,
      }),
      addChaptersStep({
        chapters,
        courseId: course.id,
        locale: suggestion.locale,
        organizationId: course.organizationId,
      }),
    ]);

    const firstChapter = chapters[0];

    if (firstChapter) {
      await generateLessonsStep({
        chapter: firstChapter,
        courseId: course.id,
        courseTitle,
        locale: suggestion.locale,
        organizationId: course.organizationId,
      });
    }

    await updateRunStatusStep({
      courseId: course.id,
      runId,
      status: "completed",
    });

    return {
      courseId: course.id,
      slug: course.slug,
      status: "completed",
    };
  } catch (error) {
    await updateStatusStep({
      courseId: course.id,
      status: "failed",
    });

    await updateRunStatusStep({
      courseId: course.id,
      runId,
      status: "failed",
    });

    throw error;
  }
}
