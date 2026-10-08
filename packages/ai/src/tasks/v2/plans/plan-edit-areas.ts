import { normalizeString } from "@zoonk/utils/string";

/** Areas match the plan's names by meaning of case and accents only; unknown ones are dropped. */
export function matchAreas({
  areas,
  values,
}: {
  areas: readonly string[];
  values: readonly string[] | null;
}): string[] {
  const known = new Map(areas.map((area) => [normalizeString(area), area]));

  return [
    ...new Set(
      (values ?? []).flatMap((value) => {
        const area = known.get(normalizeString(value));
        return area ? [area] : [];
      }),
    ),
  ];
}
