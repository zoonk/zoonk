/** A scenario's shape: where a screen is, who sees it, how it's reached and what it shows. */
type Pointer = "keys" | "touch";

/** Where the screen is and who sees it. `persona` is `pnpm dev:persona`'s name and flags. */
export type Prerequisites = {
  persona: { flags?: string[]; name: string } | "visitor";
  /** A state no persona or step reaches yet: what has to be seeded first. */
  seed?: string;
  /** A named state written on the persona's copy (`SCENARIO_STATES` in core's seed). */
  state?: string;
  /** Values the page keeps on the device, as `verify:pages --local-storage`. */
  storage?: Record<string, string>;
};

/** One step toward the state, in the words a learner sees. */
export type Step =
  | { click: string }
  | { fill: { field: string; value: string } }
  /** Milliseconds to let pass, where a step depends on time (a rhythm's taps over its beat). */
  | { pause: number }
  | { press: string }
  | { scroll: "end" }
  | { wait: string };

/** An element a state pair compares: its id is the same on every platform. */
export type Anchor = { id: string; web?: string };

export type Scenario = {
  /** The app it runs in: Main, or the playground, which shows the player's screens alone. */
  app?: "playground";
  id: string;
  screen: string;
  /** The page the steps start from, where it isn't the screen (a tap that opens the screen). */
  from?: string;
  prerequisites: Prerequisites;
  /** The steps after the screen loads; null when the web can't reach it yet. */
  reach: Step[] | null;
  /** Words on the screen that prove this state is showing. */
  proof: string;
  /** Its steps change what the learner has (a skip that saves), so each size gets its own learner. */
  writes?: boolean;
  /**
   * The page's placeholder, as a hard load first paints it before its content streams in: proven
   * by its `aria-busy` region, since its words haven't come yet.
   */
  firstPaint?: boolean;
  /**
   * Each configuration to capture. `locale` loads the screen in that language (English when
   * absent); `textScale` sets the browser's default text size to that multiple of 16 px, as a
   * learner's text-size setting does (Android's font scale, Apple's Dynamic Type).
   */
  sizes: { locale?: string; pointer: Pointer; size: string; textScale?: number }[];
  anchors: Anchor[];
  /**
   * The scenario this one is the other half of, and the anchors allowed to change between them.
   * `placeholder`: the other half is this page's placeholder, so what it draws stays where it is
   * and the page may add what it didn't draw.
   */
  pair?: { change: string[]; placeholder?: boolean; with: string };
};

export const PHONE_AND_LAPTOP: Scenario["sizes"] = [
  { pointer: "touch", size: "phone" },
  { pointer: "keys", size: "laptop" },
];
