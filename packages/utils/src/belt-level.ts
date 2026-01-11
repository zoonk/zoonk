export type BeltColor =
  | "white"
  | "yellow"
  | "orange"
  | "green"
  | "blue"
  | "purple"
  | "brown"
  | "red"
  | "gray"
  | "black";

export const BELT_COLORS_ORDER: BeltColor[] = [
  "white",
  "yellow",
  "orange",
  "green",
  "blue",
  "purple",
  "brown",
  "red",
  "gray",
  "black",
];

export type BeltLevelResult = {
  bpToNextLevel: number;
  color: BeltColor;
  isMaxLevel: boolean;
  level: number;
};

type BeltConfig = {
  bpPerLevel: number;
  color: BeltColor;
  startBp: number;
};

const BELT_CONFIGS: BeltConfig[] = [
  { bpPerLevel: 250, color: "white", startBp: 0 },
  { bpPerLevel: 500, color: "yellow", startBp: 2500 },
  { bpPerLevel: 1000, color: "orange", startBp: 7500 },
  { bpPerLevel: 5000, color: "green", startBp: 17_500 },
  { bpPerLevel: 10_000, color: "blue", startBp: 67_500 },
  { bpPerLevel: 20_000, color: "purple", startBp: 167_500 },
  { bpPerLevel: 40_000, color: "brown", startBp: 367_500 },
  { bpPerLevel: 60_000, color: "red", startBp: 767_500 },
  { bpPerLevel: 80_000, color: "gray", startBp: 1_367_500 },
  { bpPerLevel: 100_000, color: "black", startBp: 2_167_500 },
];

const LEVELS_PER_COLOR = 10;

function findCurrentBelt(bp: number): BeltConfig {
  for (let i = BELT_CONFIGS.length - 1; i >= 0; i--) {
    const belt = BELT_CONFIGS[i];
    if (belt && bp >= belt.startBp) {
      return belt;
    }
  }
  return BELT_CONFIGS[0] as BeltConfig;
}

export function calculateBeltLevel(totalBrainPower: number): BeltLevelResult {
  const bp = Math.max(0, totalBrainPower);
  const currentBelt = findCurrentBelt(bp);

  const bpInCurrentBelt = bp - currentBelt.startBp;
  const level = Math.min(
    LEVELS_PER_COLOR,
    Math.floor(bpInCurrentBelt / currentBelt.bpPerLevel) + 1,
  );

  const isMaxLevel =
    currentBelt.color === "black" && level === LEVELS_PER_COLOR;

  if (isMaxLevel) {
    return {
      bpToNextLevel: 0,
      color: currentBelt.color,
      isMaxLevel: true,
      level: LEVELS_PER_COLOR,
    };
  }

  const bpForCurrentLevel = (level - 1) * currentBelt.bpPerLevel;
  const bpToNextLevel =
    currentBelt.bpPerLevel - (bpInCurrentBelt - bpForCurrentLevel);

  return {
    bpToNextLevel,
    color: currentBelt.color,
    isMaxLevel: false,
    level,
  };
}
