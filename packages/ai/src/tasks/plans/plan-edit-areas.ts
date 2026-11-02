import { normalizeString } from "@zoonk/utils/string";

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
