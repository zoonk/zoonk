import { type SupportedLocale, getContentLocale } from "@zoonk/utils/locale";
import { hashSeed } from "@zoonk/utils/seeded-random";

/**
 * First names and towns for the people and places of examples and questions, past the few every
 * model reaches for. Writers working in parallel (a chapter's lessons, a skill's question sets,
 * placement's batches) never see each other's choices, so left alone they all pick the same
 * "Lívia" in "Campinas"; each call gets its own slice of these lists instead.
 */
type CastPool = { names: readonly string[]; places: readonly string[] };

/* oxlint-disable eslint/sort-keys -- Names alternate women and men; places spread over regions. */
const CAST_POOLS: Record<SupportedLocale, CastPool> = {
  de: {
    names: [
      "Lea",
      "Tim",
      "Clara",
      "Niklas",
      "Zeynep",
      "Tobias",
      "Marie",
      "Erik",
      "Nora",
      "Can",
      "Julia",
      "Simon",
      "Elif",
      "David",
      "Leonie",
      "Malte",
      "Ida",
      "Yusuf",
      "Greta",
      "Philipp",
      "Selin",
      "Ole",
      "Frieda",
      "Fabian",
    ],
    places: [
      "Freiburg",
      "Rostock",
      "Kassel",
      "Erfurt",
      "Regensburg",
      "Bremen",
      "Mainz",
      "Kiel",
      "Augsburg",
      "Würzburg",
      "Magdeburg",
      "Potsdam",
      "Oldenburg",
      "Ulm",
      "Lübeck",
      "Göttingen",
      "Jena",
      "Trier",
      "Chemnitz",
      "Saarbrücken",
    ],
  },
  en: {
    names: [
      "Maya",
      "Andre",
      "Keisha",
      "Tyler",
      "Mei",
      "Carlos",
      "Hannah",
      "Darius",
      "Rosa",
      "Kevin",
      "Leah",
      "Malik",
      "Fatima",
      "Owen",
      "Tanya",
      "Hector",
      "Amara",
      "Ryan",
      "Lucy",
      "Dev",
      "Naomi",
      "Caleb",
      "Iris",
      "Trevor",
    ],
    places: [
      "Boise",
      "Tucson",
      "Omaha",
      "Albuquerque",
      "Raleigh",
      "Spokane",
      "Tulsa",
      "Madison",
      "Richmond",
      "Fresno",
      "Savannah",
      "Anchorage",
      "Des Moines",
      "Louisville",
      "Sacramento",
      "Baton Rouge",
      "Little Rock",
      "Wichita",
      "El Paso",
      "Providence",
    ],
  },
  es: {
    names: [
      "Alba",
      "Rubén",
      "Noelia",
      "Iker",
      "Marta",
      "Sergio",
      "Aitana",
      "Óscar",
      "Nerea",
      "Adrián",
      "Yasmina",
      "Iván",
      "Rocío",
      "Marcos",
      "Ainhoa",
      "Raúl",
      "Inés",
      "Guillermo",
      "Claudia",
      "Mohamed",
      "Pilar",
      "Unai",
      "Olga",
      "Héctor",
    ],
    places: [
      "Zaragoza",
      "Murcia",
      "Valladolid",
      "Vigo",
      "Gijón",
      "Córdoba",
      "Alicante",
      "Granada",
      "Pamplona",
      "Santander",
      "Salamanca",
      "Cáceres",
      "Logroño",
      "Burgos",
      "Almería",
      "Huelva",
      "Oviedo",
      "Badajoz",
      "Girona",
      "Cádiz",
    ],
  },
  fr: {
    names: [
      "Manon",
      "Théo",
      "Zoé",
      "Rayan",
      "Clara",
      "Antoine",
      "Yasmine",
      "Maxime",
      "Juliette",
      "Bastien",
      "Océane",
      "Malik",
      "Pauline",
      "Romain",
      "Anaïs",
      "Mehdi",
      "Margaux",
      "Florian",
      "Aminata",
      "Quentin",
      "Élise",
      "Samir",
      "Nora",
      "Benoît",
    ],
    places: [
      "Rennes",
      "Grenoble",
      "Dijon",
      "Angers",
      "Nîmes",
      "Reims",
      "Le Havre",
      "Clermont-Ferrand",
      "Limoges",
      "Tours",
      "Amiens",
      "Perpignan",
      "Metz",
      "Besançon",
      "Orléans",
      "Caen",
      "Nancy",
      "Poitiers",
      "Brest",
      "Annecy",
    ],
  },
  pt: {
    names: [
      "Iara",
      "Otávio",
      "Débora",
      "Wesley",
      "Nayara",
      "Renan",
      "Jussara",
      "Kauã",
      "Tainá",
      "Edson",
      "Marília",
      "Davi",
      "Raíssa",
      "Fábio",
      "Cíntia",
      "Igor",
      "Priscila",
      "Wagner",
      "Lorena",
      "Raimundo",
      "Thaís",
      "Murilo",
      "Sabrina",
      "Cauê",
      "Rosana",
      "Leandro",
      "Valéria",
      "Danilo",
    ],
    places: [
      "Maringá",
      "Petrolina",
      "Campina Grande",
      "Juazeiro do Norte",
      "Caxias do Sul",
      "Uberlândia",
      "Feira de Santana",
      "Joinville",
      "Teresina",
      "São Luís",
      "Natal",
      "Cuiabá",
      "Campo Grande",
      "Goiânia",
      "Palmas",
      "Porto Velho",
      "Belém",
      "Vitória",
      "Londrina",
      "Ribeirão Preto",
      "Santarém",
      "Mossoró",
      "Montes Claros",
      "Pelotas",
      "Blumenau",
      "Imperatriz",
      "Chapecó",
      "Macapá",
    ],
  },
};
/* oxlint-enable eslint/sort-keys */

/** Enough for a whole set (placement writes several skills' questions in one call) to never repeat. */
const CAST_NAMES = 8;
const CAST_PLACES = 8;

/** `count` items from `start` on, wrapping around the list. */
function sliceFrom<T>({
  count,
  items,
  start,
}: {
  count: number;
  items: readonly T[];
  start: number;
}) {
  return [...items.slice(start), ...items.slice(0, start)].slice(0, count);
}

/**
 * The people and places one writing call uses for its examples, picked from the language's lists
 * where `seed` (the lesson, or the skill and format of a question set) points, so parallel calls
 * get different ones and the same call always gets the same. Languages without lists get "none".
 */
export function formatCast({ language, seed }: { language: string; seed: string }): string {
  const locale = getContentLocale(language);

  if (!locale) {
    return "CAST: none";
  }

  const pool = CAST_POOLS[locale];
  const hash = hashSeed(seed);

  const names = sliceFrom({
    count: CAST_NAMES,
    items: pool.names,
    start: hash % pool.names.length,
  });

  const places = sliceFrom({
    count: CAST_PLACES,
    items: pool.places,
    start: Math.floor(hash / pool.names.length) % pool.places.length,
  });

  return `CAST: people ${names.join(", ")}; places ${places.join(", ")}`;
}
