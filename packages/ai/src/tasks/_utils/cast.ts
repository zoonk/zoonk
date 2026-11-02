import { type SupportedLocale, getContentLocale } from "@zoonk/utils/locale";
import { hashSeed } from "@zoonk/utils/seeded-random";

/**
 * Writers working in parallel never see each other's choices, so left alone they all pick the same
 * "Lívia" in "Campinas"; each call gets its own slice of these comma-separated lists instead.
 */
type CastPool = { names: string; places: string };

/* oxlint-disable eslint/sort-keys -- Names alternate women and men; places spread over regions. */
const CAST_POOLS: Record<SupportedLocale, CastPool> = {
  de: {
    names:
      "Lea, Tim, Clara, Niklas, Zeynep, Tobias, Marie, Erik, Nora, Can, Julia, Simon, Elif, David, Leonie, Malte, Ida, Yusuf, Greta, Philipp, Selin, Ole, Frieda, Fabian",
    places:
      "Freiburg, Rostock, Kassel, Erfurt, Regensburg, Bremen, Mainz, Kiel, Augsburg, Würzburg, Magdeburg, Potsdam, Oldenburg, Ulm, Lübeck, Göttingen, Jena, Trier, Chemnitz, Saarbrücken",
  },
  en: {
    names:
      "Maya, Andre, Keisha, Tyler, Mei, Carlos, Hannah, Darius, Rosa, Kevin, Leah, Malik, Fatima, Owen, Tanya, Hector, Amara, Ryan, Lucy, Dev, Naomi, Caleb, Iris, Trevor",
    places:
      "Boise, Tucson, Omaha, Albuquerque, Raleigh, Spokane, Tulsa, Madison, Richmond, Fresno, Savannah, Anchorage, Des Moines, Louisville, Sacramento, Baton Rouge, Little Rock, Wichita, El Paso, Providence",
  },
  es: {
    names:
      "Alba, Rubén, Noelia, Iker, Marta, Sergio, Aitana, Óscar, Nerea, Adrián, Yasmina, Iván, Rocío, Marcos, Ainhoa, Raúl, Inés, Guillermo, Claudia, Mohamed, Pilar, Unai, Olga, Héctor",
    places:
      "Zaragoza, Murcia, Valladolid, Vigo, Gijón, Córdoba, Alicante, Granada, Pamplona, Santander, Salamanca, Cáceres, Logroño, Burgos, Almería, Huelva, Oviedo, Badajoz, Girona, Cádiz",
  },
  fr: {
    names:
      "Manon, Théo, Zoé, Rayan, Clara, Antoine, Yasmine, Maxime, Juliette, Bastien, Océane, Malik, Pauline, Romain, Anaïs, Mehdi, Margaux, Florian, Aminata, Quentin, Élise, Samir, Nora, Benoît",
    places:
      "Rennes, Grenoble, Dijon, Angers, Nîmes, Reims, Le Havre, Clermont-Ferrand, Limoges, Tours, Amiens, Perpignan, Metz, Besançon, Orléans, Caen, Nancy, Poitiers, Brest, Annecy",
  },
  it: {
    names:
      "Elisa, Davide, Federica, Simone, Noemi, Riccardo, Andreea, Nicola, Ilaria, Youssef, Lucia, Gabriele, Klea, Michele, Arianna, Samuele, Veronica, Emanuele, Giorgia, Pietro, Serena, Ardit, Valentina, Salvatore, Oksana, Daniele",
    places:
      "Verona, Lecce, Trento, Cagliari, Perugia, Salerno, Bergamo, Siracusa, Ancona, Udine, Cosenza, Parma, Pescara, Sassari, Padova, Reggio Calabria, Livorno, Trieste, Potenza, Ravenna, L'Aquila, Bolzano, Matera, Modena, Messina, Aosta",
  },
  ja: {
    names:
      "千尋, 悠斗, 真央, 直樹, ホア, 颯太, 菜々子, 隼人, 遥, ラファエル, 詩織, 和也, 茜, 誠, ミンジ, 慎吾, 莉子, 浩二, 智子, アルジュン, 夏美, 優介, 恵, 樹, 彩花, 亮",
    places:
      "旭川, 金沢, 熊本, 盛岡, 浜松, 松山, 宇都宮, 岡山, 函館, 長崎, 新潟, 高知, 秋田, 姫路, 松本, 鹿児島, 郡山, 奈良, 松江, 那覇, 川越, 岐阜, 徳島, 下関, 高崎, 石垣",
  },
  ko: {
    names:
      "예린, 태민, 다은, 승현, 흐엉, 재원, 소윤, 건우, 미경, 투안, 채원, 준호, 나연, 상훈, 알리나, 민재, 혜진, 우진, 은정, 성훈, 윤서, 시우, 가영, 정우, 보람, 동건",
    places:
      "전주, 춘천, 여수, 안동, 청주, 진주, 강릉, 목포, 경주, 천안, 군산, 통영, 원주, 순천, 포항, 세종, 충주, 김해, 속초, 남원, 구미, 공주, 서귀포, 파주, 거제, 평택",
  },
  pl: {
    names:
      "Natalia, Mateusz, Weronika, Bartosz, Olena, Michał, Agnieszka, Kamil, Magdalena, Wojciech, Karolina, Taras, Paulina, Szymon, Aleksandra, Łukasz, Ewa, Grzegorz, Iryna, Krzysztof, Joanna, Bohdan, Martyna, Tomasz, Gabriela, Igor",
    places:
      "Gdynia, Rzeszów, Zielona Góra, Olsztyn, Kielce, Opole, Toruń, Zakopane, Suwałki, Kalisz, Przemyśl, Koszalin, Częstochowa, Płock, Legnica, Białystok, Tarnów, Gorzów Wielkopolski, Siedlce, Gliwice, Słupsk, Zamość, Radom, Bielsko-Biała, Elbląg, Sandomierz",
  },
  pt: {
    names:
      "Iara, Otávio, Débora, Wesley, Nayara, Renan, Jussara, Kauã, Tainá, Edson, Marília, Davi, Raíssa, Fábio, Cíntia, Igor, Priscila, Wagner, Lorena, Raimundo, Thaís, Murilo, Sabrina, Cauê, Rosana, Leandro, Valéria, Danilo",
    places:
      "Maringá, Petrolina, Campina Grande, Juazeiro do Norte, Caxias do Sul, Uberlândia, Feira de Santana, Joinville, Teresina, São Luís, Natal, Cuiabá, Campo Grande, Goiânia, Palmas, Porto Velho, Belém, Vitória, Londrina, Ribeirão Preto, Santarém, Mossoró, Montes Claros, Pelotas, Blumenau, Imperatriz, Chapecó, Macapá",
  },
  tr: {
    names:
      "Ecem, Kerem, Rojda, Onur, Gizem, Baran, Selin, Tolga, Berfin, Uğur, Dilan, Serkan, Büşra, Ozan, İrem, Cem, Esra, Hakan, Nazlı, Barış, Tuğba, Rojhat, Pınar, Kaan, Hazal, Murat",
    places:
      "Trabzon, Eskişehir, Van, Denizli, Samsun, Mardin, Çanakkale, Kayseri, Erzurum, Muğla, Antakya, Edirne, Sivas, Rize, Şanlıurfa, Aydın, Malatya, Sakarya, Isparta, Kars, Balıkesir, Elazığ, Ordu, Tekirdağ, Bolu, Zonguldak",
  },
};
/* oxlint-enable eslint/sort-keys */

/** Enough for a whole set (placement writes several skills' questions in one call). */
const CAST_NAMES = 8;
const CAST_PLACES = 8;

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

/** The same `seed` always gets the same cast; languages without lists get "none". */
export function formatCast({ language, seed }: { language: string; seed: string }): string {
  const locale = getContentLocale(language);

  if (!locale) {
    return "CAST: none";
  }

  const pool = CAST_POOLS[locale];
  const allNames = pool.names.split(", ");
  const allPlaces = pool.places.split(", ");
  const hash = hashSeed(seed);

  const names = sliceFrom({ count: CAST_NAMES, items: allNames, start: hash % allNames.length });

  const places = sliceFrom({
    count: CAST_PLACES,
    items: allPlaces,
    start: Math.floor(hash / allNames.length) % allPlaces.length,
  });

  return `CAST: people ${names.join(", ")}; places ${places.join(", ")}`;
}
