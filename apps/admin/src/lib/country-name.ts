const regionNames = new Intl.DisplayNames("en", { type: "region" });

/** `ZZ` is what an exam with no country of its own is stored under. */
const ANY_COUNTRY = "ZZ";

export function countryName(code: string): string {
  return code === ANY_COUNTRY ? "Any country" : (regionNames.of(code) ?? code);
}
