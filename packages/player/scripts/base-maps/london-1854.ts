/**
 * Soho as John Snow mapped it in 1854, simplified to its main streets. Street names are the
 * 1854 ones (Broad Street is today's Broadwick Street, Cambridge Street today's Lexington
 * Street). Positions are approximate, to within a few dozen meters. Coordinates are
 * "longitude latitude" pairs, like the other outlines.
 */
export const SOHO_1854_STREETS = [
  {
    coordinates:
      "-0.145 51.5149, -0.1419 51.5152, -0.138 51.5156, -0.134 51.516, -0.131 51.5163, -0.128 51.5166",
    isLabelled: true,
    name: "Oxford Street",
  },
  {
    coordinates:
      "-0.1419 51.517, -0.1419 51.5152, -0.1412 51.514, -0.1403 51.5125, -0.1397 51.5113, -0.1392 51.51, -0.1385 51.509",
    isLabelled: true,
    name: "Regent Street",
  },
  {
    coordinates: "-0.1392 51.5135, -0.1374 51.5136, -0.1367 51.5134, -0.1338 51.5132",
    isLabelled: true,
    name: "Broad Street",
  },
  {
    coordinates: "-0.1368 51.5157, -0.1371 51.5148, -0.1374 51.5136",
    isLabelled: true,
    name: "Poland Street",
  },
  {
    coordinates: "-0.141 51.514, -0.1395 51.5142, -0.1378 51.5144, -0.1352 51.5147",
    isLabelled: false,
    name: "Great Marlborough Street",
  },
  {
    coordinates: "-0.1386 51.5143, -0.1386 51.5135, -0.1388 51.5122",
    isLabelled: false,
    name: "Marshall Street",
  },
  { coordinates: "-0.1397 51.5141, -0.1397 51.5121", isLabelled: false, name: "Carnaby Street" },
  {
    coordinates: "-0.1352 51.516, -0.135 51.5145, -0.1349 51.5133, -0.1344 51.512",
    isLabelled: true,
    name: "Berwick Street",
  },
  {
    coordinates: "-0.134 51.5161, -0.1337 51.5145, -0.1332 51.513, -0.1325 51.5112, -0.132 51.51",
    isLabelled: true,
    name: "Wardour Street",
  },
  {
    coordinates: "-0.1328 51.5163, -0.1323 51.5145, -0.1317 51.5128",
    isLabelled: false,
    name: "Dean Street",
  },
  {
    coordinates: "-0.1367 51.5134, -0.1366 51.5124, -0.1364 51.5117",
    isLabelled: false,
    name: "Cambridge Street",
  },
  {
    coordinates: "-0.1358 51.5133, -0.1356 51.5116",
    isLabelled: false,
    name: "Great Pulteney Street",
  },
  {
    coordinates: "-0.1402 51.5119, -0.1388 51.5121, -0.137 51.5124, -0.1358 51.5125",
    isLabelled: false,
    name: "Beak Street",
  },
  {
    coordinates: "-0.1378 51.5106, -0.1362 51.5113, -0.1345 51.5119, -0.1333 51.5121",
    isLabelled: false,
    name: "Brewer Street",
  },
  { coordinates: "-0.1349 51.5126, -0.1334 51.5128", isLabelled: false, name: "Peter Street" },
] as const;

/** The two squares, drawn as open spaces. */
export const SOHO_1854_SQUARES = [
  {
    id: "golden-square",
    name: "Golden Square",
    polygon: "-0.1381 51.5112, -0.1368 51.5112, -0.1368 51.5119, -0.1381 51.5119",
  },
  {
    id: "soho-square",
    name: "Soho Square",
    polygon: "-0.1326 51.5151, -0.1311 51.5151, -0.1311 51.5159, -0.1326 51.5159",
  },
] as const;
