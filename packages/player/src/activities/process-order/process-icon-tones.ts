import { type ProcessIconName } from "@zoonk/core/library/activities/process-icons";

/** Color families an icon is drawn in. Each follows light and dark on its own. */
type IconTone =
  | "blue"
  | "brown"
  | "gray"
  | "green"
  | "lime"
  | "orange"
  | "pink"
  | "purple"
  | "red"
  | "sky"
  | "teal"
  | "yellow";

/**
 * Icons keep natural colors (red blood, green leaves, blue water), so they use color families
 * instead of the data tokens: each stroke is mixed toward the text color, so it follows light and
 * dark on its own and keeps at least 3:1 against the surface.
 */
export const ICON_TONE_STROKES: Record<IconTone, string> = {
  blue: "stroke-[color-mix(in_oklab,var(--color-blue-600)_78%,var(--foreground))]",
  brown: "stroke-[color-mix(in_oklab,var(--color-amber-800)_78%,var(--foreground))]",
  gray: "stroke-[color-mix(in_oklab,var(--color-slate-600)_78%,var(--foreground))]",
  green: "stroke-[color-mix(in_oklab,var(--color-green-700)_78%,var(--foreground))]",
  lime: "stroke-[color-mix(in_oklab,var(--color-lime-700)_78%,var(--foreground))]",
  orange: "stroke-[color-mix(in_oklab,var(--color-orange-600)_78%,var(--foreground))]",
  pink: "stroke-[color-mix(in_oklab,var(--color-pink-600)_78%,var(--foreground))]",
  purple: "stroke-[color-mix(in_oklab,var(--color-violet-600)_78%,var(--foreground))]",
  red: "stroke-[color-mix(in_oklab,var(--color-red-600)_78%,var(--foreground))]",
  sky: "stroke-[color-mix(in_oklab,var(--color-sky-600)_78%,var(--foreground))]",
  teal: "stroke-[color-mix(in_oklab,var(--color-teal-700)_78%,var(--foreground))]",
  yellow: "stroke-[color-mix(in_oklab,var(--color-yellow-600)_78%,var(--foreground))]",
};

/**
 * A color for what the icon stands for (sunlight, water, living things), never for the step's
 * place in the process, so colors can't hint at the order.
 */
export const PROCESS_ICON_TONES: Partial<Record<ProcessIconName, IconTone>> = {
  activity: "red",
  apple: "red",
  "arrow-right-left": "teal",
  atom: "purple",
  battery: "lime",
  "battery-charging": "lime",
  beaker: "purple",
  bird: "brown",
  brain: "purple",
  bug: "brown",
  check: "green",
  cloud: "sky",
  "cloud-lightning": "blue",
  "cloud-rain": "sky",
  "cloud-snow": "sky",
  code: "blue",
  coins: "yellow",
  cpu: "blue",
  database: "blue",
  dna: "purple",
  droplet: "sky",
  droplets: "sky",
  earth: "sky",
  egg: "brown",
  factory: "orange",
  feather: "brown",
  filter: "sky",
  fish: "sky",
  flag: "red",
  flame: "orange",
  "flask-conical": "purple",
  flower: "green",
  gem: "purple",
  globe: "sky",
  hammer: "brown",
  heart: "red",
  "heart-pulse": "red",
  key: "yellow",
  leaf: "green",
  lightbulb: "yellow",
  magnet: "purple",
  mail: "blue",
  megaphone: "orange",
  merge: "teal",
  microscope: "purple",
  moon: "blue",
  mountain: "brown",
  "mountain-snow": "brown",
  orbit: "blue",
  package: "brown",
  pickaxe: "brown",
  pill: "red",
  plug: "yellow",
  rabbit: "brown",
  radiation: "purple",
  recycle: "green",
  "refresh-cw": "teal",
  repeat: "teal",
  rocket: "orange",
  satellite: "blue",
  scroll: "brown",
  send: "blue",
  server: "blue",
  shell: "brown",
  ship: "sky",
  snowflake: "sky",
  split: "teal",
  sprout: "green",
  stethoscope: "red",
  sun: "yellow",
  sunrise: "yellow",
  sunset: "yellow",
  syringe: "red",
  telescope: "blue",
  "test-tube": "purple",
  thermometer: "orange",
  "tree-deciduous": "green",
  "tree-pine": "green",
  truck: "brown",
  waves: "sky",
  wheat: "green",
  wind: "sky",
  worm: "green",
  wrench: "brown",
  zap: "yellow",
};
