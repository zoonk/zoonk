import { AlternativeTitlesEditor } from "@/components/alternative-titles/alternative-titles-editor";
import { listAlternativeTitles } from "@/data/alternative-titles/list-alternative-titles";
import { getCourse } from "@/data/courses/get-course";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import {
  addAlternativeTitleAction,
  deleteAlternativeTitleAction,
  exportAlternativeTitlesAction,
  importAlternativeTitlesAction,
} from "./_actions/alternative-titles";

export async function CourseAlternativeTitles({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[courseSlug]">["params"];
}) {
  const { courseSlug, orgSlug } = await params;

  if (orgSlug !== AI_ORG_SLUG) {
    return null;
  }

  const { data: course } = await getCourse({ courseSlug, orgSlug });

  if (!course) {
    return null;
  }

  const titles = await listAlternativeTitles({ courseId: course.id });

  const routeParams = {
    courseId: course.id,
    courseSlug,
    language: course.language,
    orgSlug,
  };

  return (
    <AlternativeTitlesEditor
      onAdd={addAlternativeTitleAction.bind(null, routeParams)}
      onDelete={deleteAlternativeTitleAction.bind(null, routeParams)}
      onExport={exportAlternativeTitlesAction.bind(null, course.id)}
      onImport={importAlternativeTitlesAction.bind(null, routeParams)}
      titles={titles}
    />
  );
}
