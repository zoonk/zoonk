/**
 * The Roman Empire when Trajan died in 117 CE, with Dacia, Armenia and Mesopotamia, drawn as a
 * coarse outline that only needs to be right on land: it follows the Rhine and Danube frontiers,
 * the Stanegate in Britain (Hadrian's Wall came a few years later) and the desert edges of Syria,
 * Arabia, Egypt and North Africa.
 */
export const ROMAN_EMPIRE_117 =
  "-10.5 34.2, -10.5 43.8, -6 48.5, -6.6 49.8, -5.9 51.6, -5.3 52.5, -5.4 53.3, -4 54.5, -3.3 54.92, -2.5 55, -1.4 55.02, 0.5 55.2, 2.8 53, 4.3 52.2, 5.1 52.1, 5.9 51.85, 6.45 51.65, 6.75 51.35, 6.95 50.94, 7.2 50.7, 7.35 50.5, 7.7 50.4, 8.3 50.3, 8.8 50.45, 9 50.2, 9 49.95, 9.2 49.5, 9.5 49.2, 9.65 48.85, 10.3 48.95, 10.8 49.05, 11.8 48.9, 12.1 49.02, 12.9 48.75, 13.45 48.57, 14.3 48.3, 15.4 48.25, 16.4 48.2, 16.9 48.12, 17.8 47.75, 18.9 47.8, 19.05 47.5, 18.9 46.5, 18.75 45.8, 19.1 45.3, 19.9 45.25, 20.5 44.8, 21 45.2, 21.5 46.2, 22.5 47, 23 47.3, 24 47.4, 24.8 47.2, 25.3 46.8, 25.8 46.1, 25.6 45.4, 25.1 44.6, 25.3 43.65, 26 43.85, 27.3 44.15, 28 45.45, 29 45.4, 29.8 45.25, 30.5 44.5, 33 43, 38 42, 41.5 42.2, 41.5 41.6, 42.8 41.4, 44.5 41.2, 45.8 40.9, 46.3 40.3, 46 39, 44.8 38.3, 44.7 37, 45.3 35.8, 45.9 34.5, 46.5 33, 47.8 31.5, 48.6 30, 48 29.6, 46.5 30.5, 44.5 32, 42 33.3, 40.5 34.2, 39 33.5, 38.5 31.5, 38 29.8, 38.3 27.5, 38 26.3, 36.8 26, 35.5 25.5, 35.5 22.9, 31 22.9, 29 24.5, 27.5 25.5, 25 29, 24 30.2, 19 29.8, 16 30.6, 14 31, 11 31.5, 9.5 32.3, 8.5 33.3, 7 34.2, 5.5 34.6, 3.5 35, 1 35.2, -1 34.8, -5.3 34, -7 33.8";

/** The Parthian Empire, Rome's great rival to the east, where it meets the map. */
export const PARTHIAN_EMPIRE =
  "46 39, 44.8 38.3, 44.7 37, 45.3 35.8, 45.9 34.5, 46.5 33, 47.8 31.5, 48.6 30, 50 28, 56 24, 62 24, 62 37.5, 54 37.5, 50.5 37.5, 49 38.5, 48.3 39.3, 47 39.3";

export const ROMAN_LABELS = [
  { key: "romanEmpire", position: "31.5 39.3", text: "Roman Empire" },
  { key: "parthianEmpire", position: "47.2 35.2", text: "Parthian Empire" },
] as const satisfies readonly { key: string; position: string; text: string }[];
