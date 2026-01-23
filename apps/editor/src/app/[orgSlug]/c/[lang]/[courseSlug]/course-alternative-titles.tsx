import { AlternativeTitlesEditor } from "@/components/alternative-titles-editor";
import { listAlternativeTitles } from "@/data/alternative-titles/list-alternative-titles";
import { getCourse } from "@/data/courses/get-course";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import {
  addAlternativeTitleAction,
  deleteAlternativeTitleAction,
  exportAlternativeTitlesAction,
  importAlternativeTitlesAction,
} from "./actions";

export async function CourseAlternativeTitles({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">["params"];
}) {
  const { courseSlug, lang, orgSlug } = await params;

  if (orgSlug !== AI_ORG_SLUG) {
    return null;
  }

  const { data: course } = await getCourse({
    courseSlug,
    language: lang,
    orgSlug,
  });

  if (!course) {
    return null;
  }

  const titles = await listAlternativeTitles({ courseId: course.id });

  const routeParams = {
    courseId: course.id,
    courseSlug,
    lang,
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
