import { type JsonLdObject } from "@/components/public/json-ld";
import { SITE_URL } from "@zoonk/utils/url";

const SCHEMA_CONTEXT = "https://schema.org";
const MINUTES_PER_HOUR = 60;

type Named = { name: string; url: string };

const PROVIDER: JsonLdObject = { "@type": "Organization", name: "Zoonk", sameAs: SITE_URL };

/** Durations in structured data are ISO 8601 (`PT2H14M`). */
function toIsoDuration(totalMinutes: number): string {
  const minutes = Math.max(Math.round(totalMinutes), 0);
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;

  if (hours === 0) {
    return `PT${rest}M`;
  }

  return rest === 0 ? `PT${hours}H` : `PT${hours}H${rest}M`;
}

export function breadcrumbJsonLd(items: Named[]): JsonLdObject {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      item: item.url,
      name: item.name,
      position: index + 1,
    })),
  };
}

export function courseJsonLd({
  description,
  language,
  levels,
  name,
  totalMinutes,
  url,
}: Named & {
  description: string;
  language: string;
  levels: string[];
  totalMinutes: number;
}): JsonLdObject {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Course",
    description,
    educationalLevel: levels.length > 0 ? levels : undefined,
    hasCourseInstance:
      totalMinutes > 0
        ? {
            "@type": "CourseInstance",
            courseMode: "online",
            courseWorkload: toIsoDuration(totalMinutes),
          }
        : undefined,
    inLanguage: language,
    isAccessibleForFree: true,
    name,
    provider: PROVIDER,
    url,
  };
}

export function lessonListJsonLd({
  lessons,
  name,
  url,
}: Named & { lessons: Named[] }): JsonLdObject {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "ItemList",
    itemListElement: lessons.map((lesson, index) => ({
      "@type": "ListItem",
      name: lesson.name,
      position: index + 1,
      url: lesson.url,
    })),
    name,
    numberOfItems: lessons.length,
    url,
  };
}

export function lessonJsonLd({
  course,
  description,
  language,
  level,
  minutes,
  name,
  teaches,
  url,
}: Named & {
  course: Named;
  description: string;
  language: string;
  level: string;
  minutes: number;
  teaches: string[];
}): JsonLdObject {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "LearningResource",
    description,
    educationalLevel: level,
    inLanguage: language,
    isAccessibleForFree: true,
    isPartOf: { "@type": "Course", name: course.name, url: course.url },
    learningResourceType: "Lesson",
    name,
    provider: PROVIDER,
    teaches: teaches.length > 0 ? teaches : undefined,
    timeRequired: toIsoDuration(minutes),
    url,
  };
}

export const HOME_JSON_LD: JsonLdObject[] = [
  { "@context": SCHEMA_CONTEXT, "@type": "WebSite", name: "Zoonk", url: `${SITE_URL}/` },
  {
    "@context": SCHEMA_CONTEXT,
    "@type": "Organization",
    logo: `${SITE_URL}/apple-icon.png`,
    name: "Zoonk",
    url: `${SITE_URL}/`,
  },
];
