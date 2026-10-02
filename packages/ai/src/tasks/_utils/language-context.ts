import { type SupportedLocale, getContentLocale } from "@zoonk/utils/locale";

/**
 * The everyday world of the people who read one of the app's languages: what a writer needs so
 * examples feel local instead of translated. Each language teaches one regional variant (see
 * `prompt-language.ts`), and its pack describes that same place.
 */
type LocalContextPack = {
  place: string;
  money: string;
  formats: string;
  names: string;
  places: string;
  everydayLife: string;
  school: string;
  exams: string;
  register: string;
};

/* oxlint-disable eslint/sort-keys -- Each pack reads in the order a writer uses it: where, money, then people and places. */
const LOCAL_CONTEXT_PACKS: Record<SupportedLocale, LocalContextPack> = {
  de: {
    place: "Germany",
    money: "euro, written 1.234,56 €",
    formats: "1.234,56; dates as 27.09.2026; 24-hour clock (14:30 Uhr); metric units and °C",
    names: "Mia, Ben, Emma, Paul, Hannah, Leon, Sophie, Finn, Lena, Jonas",
    places:
      "Berlin, Hamburg, München, Köln, Frankfurt, Stuttgart, Düsseldorf, Leipzig, Dresden, Hannover; the Bäckerei, the Supermarkt, the S-Bahn and U-Bahn, the Deutsche Bahn",
    everydayLife:
      "girocard (EC-Karte) and PayPal, Mehrwertsteuer (19%, 7% reduced), the yearly Steuererklärung, gesetzliche Krankenkasse, Rente, Minijob, Pfand on bottles, the Deutschlandticket",
    school:
      "Grundschule (grades 1 to 4; to 6 in Berlin and Brandenburg), then Gymnasium, Realschule, Hauptschule or Gesamtschule depending on the Land; Abitur after grade 12 or 13; Ausbildung (dual vocational training) or Studium at a Hochschule or Universität; grades from 1 (sehr gut) to 6 (ungenügend)",
    exams:
      "Abitur, Mittlere Reife, Staatsexamen (law, medicine, teaching), IHK final exams of an Ausbildung, the Führerschein theory test, TestDaF and Goethe-Zertifikat",
    register: 'address the reader as "du", informal and friendly',
  },
  en: {
    place: "the United States",
    money: "US dollars, written $1,234.56",
    formats:
      "1,234.56; dates as September 27, 2026 or 9/27/2026; 12-hour clock (3:30 p.m.); miles, pounds, gallons and °F in daily life, metric in science",
    names: "Emma, Liam, Olivia, Noah, Ava, Ethan, Sophia, Jamal, Priya, Diego",
    places:
      "New York, Los Angeles, Chicago, Houston, Phoenix, Philadelphia, Seattle, Atlanta, Miami, Denver; a grocery store, a diner, a gas station, the mall",
    everydayLife:
      "Venmo and Zelle, credit cards and credit scores, sales tax added at the register, tips of 15 to 20 percent, federal and state income tax withheld from paychecks, Tax Day in April, 401(k) and IRA, Social Security, health insurance through an employer, ZIP codes, the DMV",
    school:
      "elementary school (kindergarten to 5th grade), middle school (6th to 8th), high school (9th to 12th grade: freshman, sophomore, junior, senior), then community college or a four-year college; letter grades A to F and a GPA out of 4.0",
    exams:
      "SAT and ACT for college admission, AP exams, GED, GRE, GMAT, LSAT, MCAT, the bar exam, NCLEX, USMLE",
    register: 'address the reader as "you", friendly and direct',
  },
  es: {
    place: "Spain",
    money: "euro, written 1.234,56 € (the symbol after the number)",
    formats: "1.234,56; dates as 27/09/2026; 24-hour clock (14:30); metric units and °C",
    names: "Lucía, Hugo, Martina, Pablo, Sofía, Daniel, Carmen, Javier, Paula, Álvaro",
    places:
      "Madrid, Barcelona, Valencia, Sevilla, Zaragoza, Málaga, Bilbao, Valladolid, Palma, Las Palmas; the bar de la esquina, the mercado, the metro, Renfe and the AVE",
    everydayLife:
      "Bizum, IVA (21% general rate), the nómina, IRPF and the yearly declaración de la renta, Seguridad Social, DNI and NIE, empadronamiento, pagas extra, Mercadona",
    school:
      "educación infantil; primaria (6 years, ages 6 to 12); ESO (4 years, ages 12 to 16); bachillerato (2 years) or formación profesional (FP); then universidad (grado); grades from 0 to 10, where 5 passes",
    exams:
      "the PAU for university entrance (still called selectividad), oposiciones (teachers, Guardia Civil, the state administration and more), MIR for doctors, the DGT driving theory test, DELE",
    register:
      'address the reader as "tú" (and "vosotros" for a group), informal and warm, with Spain\'s vocabulary (ordenador, móvil, coche, zumo)',
  },
  fr: {
    place: "France",
    money: "euro, written 1 234,56 € (a space between thousands, the symbol after the number)",
    formats: "1 234,56; dates as 27/09/2026; 24-hour clock (14 h 30); metric units and °C",
    names: "Léa, Lucas, Emma, Hugo, Chloé, Louis, Inès, Gabriel, Camille, Nathan",
    places:
      "Paris, Lyon, Marseille, Toulouse, Lille, Bordeaux, Nantes, Strasbourg, Nice, Rennes; the boulangerie, the marché, the métro, the SNCF and the TGV",
    everydayLife:
      "carte bancaire, TVA (20% standard rate), Sécurité sociale with the carte Vitale and a mutuelle, the CAF, the SMIC, income tax withheld at source (prélèvement à la source), France Travail",
    school:
      "école maternelle; école élémentaire (CP to CM2, ages 6 to 11); collège (6e to 3e, ages 11 to 15); lycée (seconde, première, terminale, ages 15 to 18); then université, BTS, BUT or classes préparatoires and grandes écoles; grades out of 20, where 10 passes",
    exams:
      "the brevet, the baccalauréat (the bac), Parcoursup for university places, concours (grandes écoles, CRPE and CAPES for teachers, the civil service), the code de la route, DELF",
    register: 'address the reader as "tu", informal and warm',
  },
  pt: {
    place: "Brazil",
    money: "Brazilian real, written R$ 1.234,56",
    formats: "1.234,56; dates as 27/09/2026; 24-hour clock (14h30); metric units and °C",
    names: "Ana, João, Maria, Pedro, Juliana, Lucas, Camila, Gabriel, Beatriz, Rafael",
    places:
      "São Paulo, Rio de Janeiro, Belo Horizonte, Salvador, Recife, Fortaleza, Brasília, Curitiba, Porto Alegre, Manaus; the padaria, the feira, the supermercado, the ônibus and the metrô",
    everydayLife:
      'Pix and boleto, installments without interest ("parcelado sem juros"), 13º salário, CLT jobs and FGTS, CPF, SUS, INSS, the yearly Imposto de Renda return, iFood, Mercado Livre',
    school:
      "educação infantil; ensino fundamental (1st to 9th year, ages 6 to 14); ensino médio (3 years, ages 15 to 17); then faculdade or universidade; grades from 0 to 10; public universities admit through the ENEM (Sisu) or a vestibular",
    exams:
      "ENEM, vestibulares (Fuvest, Unicamp), concursos públicos (boards such as Cebraspe, FGV, Vunesp and FCC), the OAB exam, CNU, Revalida",
    register: 'address the reader as "você", warm and informal, the way people speak in Brazil',
  },
};
/* oxlint-enable eslint/sort-keys */

function formatPack(pack: LocalContextPack): string {
  return [
    `- Place: ${pack.place}`,
    `- Money: ${pack.money}`,
    `- Numbers, dates and units: ${pack.formats}`,
    `- Common first names: ${pack.names}`,
    `- Cities and places: ${pack.places}`,
    `- Everyday life: ${pack.everydayLife}`,
    `- School: ${pack.school}`,
    `- National exams: ${pack.exams}`,
    `- Register: ${pack.register}`,
  ].join("\n");
}

/**
 * The `LOCAL_CONTEXT` block writing prompts put next to `LANGUAGE`: the currency, formats, names,
 * places, school system, exams and register of the place the language's lessons are written for,
 * so a Portuguese lesson pays in reais at a padaria in Recife instead of in dollars. It is the
 * default, not a rule: prompts let the goal set another place (the SAT is American whatever the
 * learner's language). Languages without a pack (targets of language courses) get "none".
 */
export function formatLocalContext(language: string): string {
  const locale = getContentLocale(language);

  if (!locale) {
    return "LOCAL_CONTEXT: none";
  }

  return `LOCAL_CONTEXT:\n${formatPack(LOCAL_CONTEXT_PACKS[locale])}`;
}
