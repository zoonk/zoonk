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
import { streamStatus } from "./stream-status";

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

  await createRunStep({
    courseSuggestionId,
    runId,
    title: courseTitle,
  });

  await streamStatus({
    status: "started",
    step: "getCourseSuggestion",
    timestamp: Date.now(),
  });

  const suggestion = await getCourseSuggestionStep({
    id: courseSuggestionId,
    title: courseTitle,
  });

  await streamStatus({
    status: "completed",
    step: "getCourseSuggestion",
    timestamp: Date.now(),
  });

  await streamStatus({
    status: "started",
    step: "checkCourseExists",
    timestamp: Date.now(),
  });

  const existingCourse = await checkCourseExistsStep({
    locale: suggestion.locale,
    title: courseTitle,
  });

  await streamStatus({
    status: "completed",
    step: "checkCourseExists",
    timestamp: Date.now(),
  });

  if (existingCourse) {
    if (existingCourse.generationStatus !== "completed") {
      await updateStatusStep({
        courseId: existingCourse.id,
        status: "completed",
      });
    }

    await streamStatus({
      status: "started",
      step: "updateRunStatus",
      timestamp: Date.now(),
    });

    await updateRunStatusStep({
      courseId: existingCourse.id,
      runId,
      status: "completed",
    });

    await streamStatus({
      status: "completed",
      step: "updateRunStatus",
      timestamp: Date.now(),
    });

    return {
      courseId: existingCourse.id,
      slug: existingCourse.slug,
      status: "already_exists",
    };
  }

  await streamStatus({
    status: "started",
    step: "cleanupFailedCourse",
    timestamp: Date.now(),
  });

  await cleanupFailedCourseStep({
    locale: suggestion.locale,
    title: courseTitle,
  });

  await streamStatus({
    status: "completed",
    step: "cleanupFailedCourse",
    timestamp: Date.now(),
  });

  await streamStatus({
    status: "started",
    step: "createCourse",
    timestamp: Date.now(),
  });

  const course = await createCourseStep({
    locale: suggestion.locale,
    title: courseTitle,
  });

  await streamStatus({
    data: { courseId: course.id, slug: course.slug },
    status: "completed",
    step: "createCourse",
    timestamp: Date.now(),
  });

  try {
    await streamStatus({
      status: "started",
      step: "generateDescription",
      timestamp: Date.now(),
    });

    await streamStatus({
      status: "started",
      step: "generateImage",
      timestamp: Date.now(),
    });

    await streamStatus({
      status: "started",
      step: "generateAlternativeTitles",
      timestamp: Date.now(),
    });

    await streamStatus({
      status: "started",
      step: "generateCategories",
      timestamp: Date.now(),
    });

    await streamStatus({
      status: "started",
      step: "generateChapters",
      timestamp: Date.now(),
    });

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

    await streamStatus({
      status: "completed",
      step: "generateDescription",
      timestamp: Date.now(),
    });

    await streamStatus({
      status: "completed",
      step: "generateImage",
      timestamp: Date.now(),
    });

    await streamStatus({
      status: "completed",
      step: "generateAlternativeTitles",
      timestamp: Date.now(),
    });

    await streamStatus({
      status: "completed",
      step: "generateCategories",
      timestamp: Date.now(),
    });

    await streamStatus({
      data: { chapterCount: chapters.length },
      status: "completed",
      step: "generateChapters",
      timestamp: Date.now(),
    });

    await streamStatus({
      status: "started",
      step: "updateCourse",
      timestamp: Date.now(),
    });

    await streamStatus({
      status: "started",
      step: "addAlternativeTitles",
      timestamp: Date.now(),
    });

    await streamStatus({
      status: "started",
      step: "addCategories",
      timestamp: Date.now(),
    });

    await streamStatus({
      status: "started",
      step: "addChapters",
      timestamp: Date.now(),
    });

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

    await streamStatus({
      status: "completed",
      step: "updateCourse",
      timestamp: Date.now(),
    });

    await streamStatus({
      status: "completed",
      step: "addAlternativeTitles",
      timestamp: Date.now(),
    });

    await streamStatus({
      status: "completed",
      step: "addCategories",
      timestamp: Date.now(),
    });

    await streamStatus({
      status: "completed",
      step: "addChapters",
      timestamp: Date.now(),
    });

    const firstChapter = chapters[0];

    if (firstChapter) {
      await streamStatus({
        status: "started",
        step: "generateLessons",
        timestamp: Date.now(),
      });

      await generateLessonsStep({
        chapter: firstChapter,
        courseId: course.id,
        courseTitle,
        locale: suggestion.locale,
        organizationId: course.organizationId,
      });

      await streamStatus({
        status: "completed",
        step: "generateLessons",
        timestamp: Date.now(),
      });
    }

    await streamStatus({
      status: "started",
      step: "updateRunStatus",
      timestamp: Date.now(),
    });

    await updateRunStatusStep({
      courseId: course.id,
      runId,
      status: "completed",
    });

    await streamStatus({
      status: "completed",
      step: "updateRunStatus",
      timestamp: Date.now(),
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
