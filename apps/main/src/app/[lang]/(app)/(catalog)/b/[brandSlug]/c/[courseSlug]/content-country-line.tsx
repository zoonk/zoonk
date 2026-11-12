import { type LibraryOutline } from "@/data/catalog/resolve-catalog-route";
import { getVarietyName } from "@zoonk/utils/language-regions";
import { getExtracted } from "next-intl/server";

/**
 * Only a course written for another country than its language's own says so; today's say nothing.
 * The variety is named in the course's language, like the country.
 */
export async function ContentCountryLine({
  country,
}: {
  country: LibraryOutline["contentCountry"];
}) {
  const t = await getExtracted();

  if (!country) {
    return null;
  }

  const parts = [
    t({
      description:
        "{country} is a country's name. It always follows the colon, so it never needs an article or a case.",
      message: "Content country: {country}",
      values: { country: country.name },
    }),
    country.lessonVariety &&
      t({
        description:
          "{variety} is a language with its country, such as “Portuguese (Brazil)”. It always follows the colon, so it never needs an article or a case.",
        message: "Lesson language: {variety}",
        values: {
          variety: getVarietyName({
            ...country.lessonVariety,
            userLanguage: country.lessonVariety.language,
          }),
        },
      }),
  ].filter(Boolean);

  return <p className="text-muted-foreground mt-3 text-sm text-pretty">{parts.join(" · ")}</p>;
}
