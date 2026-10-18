import { type Transfer } from "./compose-regions";

export type Continent =
  | "africa"
  | "antarctica"
  | "asia"
  | "europe"
  | "northAmerica"
  | "oceania"
  | "southAmerica";

/**
 * Countries by continent, by their Natural Earth names in world-atlas, separated by semicolons.
 * Countries spanning two continents are listed where most people live and split below where it
 * matters for learners.
 */
const CONTINENT_COUNTRIES: Record<Continent, string> = {
  africa:
    "Algeria; Angola; Benin; Botswana; Burkina Faso; Burundi; Cabo Verde; Cameroon; Central African Rep.; Chad; Comoros; Congo; Côte d'Ivoire; Dem. Rep. Congo; Djibouti; Egypt; Eq. Guinea; Eritrea; eSwatini; Ethiopia; Gabon; Gambia; Ghana; Guinea; Guinea-Bissau; Kenya; Lesotho; Liberia; Libya; Madagascar; Malawi; Mali; Mauritania; Mauritius; Morocco; Mozambique; Namibia; Niger; Nigeria; Rwanda; S. Sudan; Saint Helena; São Tomé and Principe; Senegal; Seychelles; Sierra Leone; Somalia; Somaliland; South Africa; Sudan; Tanzania; Togo; Tunisia; Uganda; W. Sahara; Zambia; Zimbabwe",
  antarctica: "Antarctica; Fr. S. Antarctic Lands; Heard I. and McDonald Is.",
  asia: "Afghanistan; Armenia; Azerbaijan; Bahrain; Bangladesh; Bhutan; Br. Indian Ocean Ter.; Brunei; Cambodia; China; Cyprus; Georgia; Hong Kong; India; Indonesia; Iran; Iraq; Israel; Japan; Jordan; Kazakhstan; Kuwait; Kyrgyzstan; Laos; Lebanon; Macao; Malaysia; Maldives; Mongolia; Myanmar; N. Cyprus; Nepal; North Korea; Oman; Pakistan; Palestine; Philippines; Qatar; Russia; Saudi Arabia; Siachen Glacier; Singapore; South Korea; Sri Lanka; Syria; Taiwan; Tajikistan; Thailand; Timor-Leste; Turkey; Turkmenistan; United Arab Emirates; Uzbekistan; Vietnam; Yemen; Indian Ocean Ter.",
  europe:
    "Åland; Albania; Andorra; Austria; Belarus; Belgium; Bosnia and Herz.; Bulgaria; Croatia; Czechia; Denmark; Estonia; Faeroe Is.; Finland; France; Germany; Greece; Guernsey; Hungary; Iceland; Ireland; Isle of Man; Italy; Jersey; Kosovo; Latvia; Liechtenstein; Lithuania; Luxembourg; Macedonia; Malta; Moldova; Monaco; Montenegro; Netherlands; Norway; Poland; Portugal; Romania; San Marino; Serbia; Slovakia; Slovenia; Spain; Sweden; Switzerland; Ukraine; United Kingdom; Vatican",
  northAmerica:
    "Anguilla; Antigua and Barb.; Aruba; Bahamas; Barbados; Belize; Bermuda; British Virgin Is.; Canada; Cayman Is.; Costa Rica; Cuba; Curaçao; Dominica; Dominican Rep.; El Salvador; Greenland; Grenada; Guatemala; Haiti; Honduras; Jamaica; Mexico; Montserrat; Nicaragua; Panama; Puerto Rico; Saint Lucia; Sint Maarten; St-Barthélemy; St-Martin; St. Kitts and Nevis; St. Pierre and Miquelon; St. Vin. and Gren.; Trinidad and Tobago; Turks and Caicos Is.; U.S. Virgin Is.; United States of America",
  oceania:
    "American Samoa; Ashmore and Cartier Is.; Australia; Cook Is.; Fiji; Fr. Polynesia; Guam; Kiribati; Marshall Is.; Micronesia; N. Mariana Is.; Nauru; New Caledonia; New Zealand; Niue; Norfolk Island; Palau; Papua New Guinea; Pitcairn Is.; Samoa; Solomon Is.; Tonga; Vanuatu; Wallis and Futuna Is.",
  southAmerica:
    "Argentina; Bolivia; Brazil; Chile; Colombia; Ecuador; Falkland Is.; Guyana; Paraguay; Peru; S. Geo. and the Is.; Suriname; Uruguay; Venezuela",
};

function countryList(text: string): string[] {
  return text.split(";").map((country) => country.trim());
}

const CONTINENT_BY_COUNTRY: ReadonlyMap<string, Continent> = new Map(
  Object.entries(CONTINENT_COUNTRIES).flatMap(([continent, countries]) =>
    countryList(countries).map((country) => [country, toContinent(continent)] as const),
  ),
);

function toContinent(value: string): Continent {
  const continents: readonly Continent[] = [
    "africa",
    "antarctica",
    "asia",
    "europe",
    "northAmerica",
    "oceania",
    "southAmerica",
  ];

  const match = continents.find((continent) => continent === value);

  if (!match) {
    throw new Error(`Unknown continent ${value}`);
  }

  return match;
}

/** Countries that belong to a second continent too, so regional maps of both show them. */
const ALSO_ON: Readonly<Record<string, readonly Continent[]>> = {
  Cyprus: ["europe"],
  "N. Cyprus": ["europe"],
  Russia: ["europe"],
  Turkey: ["europe"],
};

/** Where a country is drawn on the map of continents. */
export function continentOf(country: string): Continent | null {
  return CONTINENT_BY_COUNTRY.get(country) ?? null;
}

/** Whether a regional map of these continents is about this country. */
export function isOnContinents(country: string, continents: readonly Continent[]): boolean {
  const home = continentOf(country);
  const others = ALSO_ON[country] ?? [];
  return continents.some((continent) => continent === home || others.includes(continent));
}

export function countriesOf(continent: Continent): readonly string[] {
  return countryList(CONTINENT_COUNTRIES[continent]);
}

/**
 * Parts of countries that sit on another continent: Russia west of the Urals and the Caspian,
 * Istanbul's side of the Bosporus, and French Guiana. The lines are coarse; they only need to
 * be right on land.
 */
export const CONTINENT_TRANSFERS: readonly Transfer[] = [
  {
    owner: "europe",
    polygon:
      "19 35, 19 82, 72 82, 70 77.5, 67 71.5, 66 69.3, 64 67, 60 64, 59.5 61, 59 58, 59.5 55, 59 53, 58.6 51.2, 55.1 51.6, 51.4 51.2, 51.5 48.5, 52.5 46, 52.5 35",
    sources: ["Russia"],
  },
  {
    owner: "europe",
    polygon: "25.5 40, 26.3 40, 26.7 40.45, 27.5 40.6, 29 41, 29.1 41.2, 29.2 42.2, 25.5 42.2",
    sources: ["Turkey"],
  },
  { owner: "southAmerica", polygon: "-55 1.5, -50.5 1.5, -50.5 6.5, -55 6.5", sources: ["France"] },
];
