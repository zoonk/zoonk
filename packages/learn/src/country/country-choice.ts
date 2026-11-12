import { type SuggestedCountry } from "@zoonk/core/goals/country-contract";

export type { SuggestedCountry } from "@zoonk/core/goals/country-contract";

/** A country as core names it, with the variety lessons use there when it could surprise. */
export type CountryChoice = Omit<SuggestedCountry, "tag">;

/** A country by name alone, for a value that isn't picked from a list. */
export type CountryName = Pick<CountryChoice, "code" | "name">;
