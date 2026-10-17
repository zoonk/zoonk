import { type RegionRule, type Transfer } from "./compose-regions";

/**
 * Europe in July 1914, built from today's countries (Natural Earth, public domain) plus the land
 * that has changed hands since. Borders that moved are simplified: they're right to within a few
 * dozen kilometers, which is enough to see who held what.
 */
export const EUROPE_1914_RULES: readonly RegionRule[] = [
  {
    id: "unitedKingdom",
    members: [
      "United Kingdom",
      "Ireland",
      "Isle of Man",
      "Guernsey",
      "Jersey",
      "Malta",
      "Cyprus",
      "N. Cyprus",
    ],
    name: "United Kingdom",
    tone: "groupA",
  },
  {
    id: "france",
    members: ["France", "Monaco", "Algeria", "Tunisia", "Morocco"],
    name: "France",
    tone: "groupA",
  },
  {
    id: "russianEmpire",
    members: [
      "Russia",
      "Finland",
      "Åland",
      "Estonia",
      "Latvia",
      "Lithuania",
      "Belarus",
      "Ukraine",
      "Moldova",
      "Poland",
      "Georgia",
      "Armenia",
      "Azerbaijan",
    ],
    name: "Russian Empire",
    tone: "groupA",
  },
  { id: "germanEmpire", members: ["Germany"], name: "German Empire", tone: "groupB" },
  {
    id: "austriaHungary",
    members: [
      "Austria",
      "Hungary",
      "Czechia",
      "Slovakia",
      "Slovenia",
      "Croatia",
      "Bosnia and Herz.",
    ],
    name: "Austria-Hungary",
    tone: "groupB",
  },
  {
    id: "italy",
    members: ["Italy", "San Marino", "Vatican", "Libya"],
    name: "Italy",
    tone: "groupB",
  },
  {
    id: "ottomanEmpire",
    members: ["Turkey", "Syria", "Iraq", "Lebanon", "Israel", "Palestine", "Jordan"],
    name: "Ottoman Empire",
    tone: "focus",
  },
  { id: "spain", members: ["Spain", "Andorra"], name: "Spain", tone: "focus" },
  { id: "portugal", members: ["Portugal"], name: "Portugal", tone: "focus" },
  {
    id: "switzerland",
    members: ["Switzerland", "Liechtenstein"],
    name: "Switzerland",
    tone: "focus",
  },
  { id: "netherlands", members: ["Netherlands"], name: "Netherlands", tone: "focus" },
  { id: "belgium", members: ["Belgium"], name: "Belgium", tone: "focus" },
  { id: "luxembourg", members: ["Luxembourg"], name: "Luxembourg", tone: "focus" },
  { id: "denmark", members: ["Denmark", "Iceland", "Faeroe Is."], name: "Denmark", tone: "focus" },
  { id: "norway", members: ["Norway"], name: "Norway", tone: "focus" },
  { id: "sweden", members: ["Sweden"], name: "Sweden", tone: "focus" },
  { id: "serbia", members: ["Serbia", "Kosovo", "Macedonia"], name: "Serbia", tone: "focus" },
  { id: "montenegro", members: ["Montenegro"], name: "Montenegro", tone: "focus" },
  { id: "albania", members: ["Albania"], name: "Albania", tone: "focus" },
  { id: "greece", members: ["Greece"], name: "Greece", tone: "focus" },
  { id: "bulgaria", members: ["Bulgaria"], name: "Bulgaria", tone: "focus" },
  { id: "romania", members: ["Romania"], name: "Romania", tone: "focus" },
];

export const EUROPE_1914_TRANSFERS: readonly Transfer[] = [
  {
    owner: "germanEmpire",
    polygon:
      "5.8 49.6, 6.8 49.2, 8.3 49.1, 7.7 47.5, 7 47.4, 6.8 47.8, 7.1 48.2, 6.8 48.5, 6.2 48.9, 5.9 49.3",
    sources: ["France"],
  },
  {
    owner: "germanEmpire",
    polygon:
      "14 55, 23.3 55, 23.3 54.4, 22.8 54.3, 22.6 53.9, 21.5 53.3, 20.6 53.2, 19.8 53.2, 19.3 53.05, 18.9 52.95, 18.9 52.7, 18.6 52.55, 18 52.3, 17.9 51.9, 18 51.6, 18.3 51.4, 18.2 51, 18.6 50.75, 18.9 50.45, 19.2 50.28, 18.4 49.98, 17 49.9, 16 50.2, 15 50.6, 14 50.8",
    sources: ["Poland"],
  },
  {
    owner: "germanEmpire",
    polygon: "19.3 54.2, 22.95 54.2, 22.95 55.35, 19.3 55.35",
    sources: ["Russia"],
  },
  {
    owner: "germanEmpire",
    polygon: "20.9 55.2, 22.9 55, 22.9 55.45, 21.3 56, 20.9 56",
    sources: ["Lithuania"],
  },
  {
    owner: "germanEmpire",
    polygon: "8 54.75, 8 55.47, 9.4 55.47, 10.2 55.2, 10.2 54.75",
    sources: ["Denmark"],
  },
  {
    owner: "austriaHungary",
    polygon:
      "18.4 49.98, 19.2 50.28, 19.95 50.12, 20.6 50.2, 21.2 50.4, 21.75 50.7, 21.9 50.8, 22.5 50.6, 23.5 50.45, 24.1 50.55, 24.7 50.3, 25.2 50.15, 25.9 49.9, 26.1 49.4, 26.2 48.7, 26.2 48.3, 25 47.7, 22.5 47.7, 22 48.5, 19 49.2, 18.4 49.5",
    sources: ["Poland", "Ukraine"],
  },
  {
    owner: "austriaHungary",
    polygon:
      "20.2 46.2, 20.2 45.2, 21.4 44.75, 22.4 44.6, 22.7 44.9, 23.2 45.3, 24.5 45.45, 25.4 45.4, 26 45.5, 26.4 45.65, 26.3 46.2, 26 46.9, 25.9 47.3, 26.35 47.55, 26.3 47.85, 26.6 48.1, 26.7 48.3, 24.5 48.2, 22.8 48.1, 21.5 47.5",
    sources: ["Romania"],
  },
  {
    owner: "austriaHungary",
    polygon:
      "18.8 46.3, 18.8 45, 19.1 44.93, 19.6 44.93, 20.1 44.83, 20.45 44.82, 20.95 44.68, 21.4 44.78, 21.7 45, 21.7 46.3",
    sources: ["Serbia"],
  },
  {
    owner: "austriaHungary",
    polygon:
      "10.4 47.2, 10.45 46.53, 10.5 46.15, 10.45 45.8, 10.8 45.78, 10.92 45.69, 11.2 45.72, 11.5 45.95, 11.7 45.97, 11.85 46.15, 12.1 46.45, 12.5 46.62, 13.3 46.52, 13.52 46.2, 13.45 46, 13.35 45.7, 13.3 45.5, 14.5 45.5, 14.5 47.2",
    sources: ["Italy"],
  },
  {
    owner: "montenegro",
    polygon: "19.9 42.3, 19.9 43.1, 20.55 42.95, 20.65 42.5, 20.45 42.2",
    sources: ["Kosovo"],
  },
  { owner: "italy", polygon: "26.5 35.3, 28.4 35.3, 28.4 37.6, 26.5 37.6", sources: ["Greece"] },
  {
    owner: "bulgaria",
    polygon: "24.7 40.85, 24.7 41.7, 26.7 41.7, 26.7 40.6, 25.2 40.85",
    sources: ["Greece"],
  },
  {
    owner: "romania",
    polygon: "26.35 43.75, 26.35 44.3, 28.8 44.3, 28.8 43.32, 27.9 43.45, 27 43.72",
    sources: ["Bulgaria"],
  },
  {
    owner: "russianEmpire",
    polygon: "41.2 41.6, 43.6 41.6, 43.8 40, 42.6 40.1, 41.8 40.5, 41.2 41.2",
    sources: ["Turkey"],
  },
];

export const EUROPE_1914_LABELS = [
  { key: "germanEmpire", position: "10.3 51.6", text: "German Empire" },
  { key: "austriaHungary", position: "17.8 47.9", text: "Austria-Hungary" },
  { key: "russianEmpire", position: "35 56.5", text: "Russian Empire" },
  { key: "ottomanEmpire", position: "33.5 39.2", text: "Ottoman Empire" },
  { key: "france", position: "2.4 46.8", text: "France" },
  { key: "unitedKingdom", position: "-1.8 52.6", text: "United Kingdom" },
  { key: "italy", position: "12.9 42.6", text: "Italy" },
  { key: "spain", position: "-3.7 40", text: "Spain" },
  { key: "serbia", position: "20.9 43.9", text: "Serbia" },
] as const satisfies readonly { key: string; position: string; text: string }[];
