import { getLanguageCountry, isCountryCode } from "@zoonk/utils/countries";
import { isLanguageRegion } from "@zoonk/utils/language-regions";
import { type GoalContentCountry } from "../country-contract";

export function toCountryChoice({ code, language }: { code: string | null; language: string }) {
  if (!code || !isCountryCode(code)) {
    return null;
  }

  return { code, name: new Intl.DisplayNames([language], { type: "region" }).of(code) ?? code };
}

export function toContentCountryView({
  code,
  editable,
  kind,
  language,
  rebuild = "none",
  source,
}: {
  code: string | null;
  editable: boolean;
  kind: GoalContentCountry["kind"];
  language: string;
  rebuild?: GoalContentCountry["rebuild"];
  source: GoalContentCountry["source"];
}): GoalContentCountry | null {
  const country = toCountryChoice({ code, language });

  if (!country) {
    return null;
  }

  const ownCountry = getLanguageCountry(language);

  return {
    ...country,
    editable,
    kind,
    lessonVariety:
      ownCountry && code !== ownCountry && isLanguageRegion({ language, region: country.code })
        ? { language, region: ownCountry }
        : null,
    rebuild,
    source,
  };
}
