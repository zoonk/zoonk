import { JsonLd } from "@/components/public/json-ld";
import { breadcrumbJsonLd, lessonJsonLd } from "@/lib/public/structured-data";
import { useSpokenText } from "@zoonk/learn/rich-text/speech";

export function LessonJsonLd({
  breadcrumbs,
  lesson,
}: {
  breadcrumbs: Parameters<typeof breadcrumbJsonLd>[0];
  lesson: Parameters<typeof lessonJsonLd>[0];
}) {
  const spoken = useSpokenText();

  return (
    <JsonLd
      items={[
        lessonJsonLd({ ...lesson, teaches: lesson.teaches.map((idea) => spoken.inline(idea)) }),
        breadcrumbJsonLd(breadcrumbs),
      ]}
    />
  );
}
