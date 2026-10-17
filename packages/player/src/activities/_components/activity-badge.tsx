"use client";

import {
  ArrowDownUp,
  ArrowLeftRight,
  Atom,
  Blocks,
  ChartLine,
  ChartSpline,
  Columns2,
  Database,
  Dices,
  Ear,
  Footprints,
  GitBranch,
  GitCompareArrows,
  Grid2x2,
  Grid2x2Check,
  Group,
  Hand,
  Headphones,
  Link2,
  ListOrdered,
  type LucideIcon,
  MapPinned,
  MessagesSquare,
  Move,
  MoveHorizontal,
  MoveVertical,
  Music,
  Piano,
  Puzzle,
  Regex,
  Repeat,
  RotateCw,
  ScanSearch,
  SlidersHorizontal,
  Split,
  SquareTerminal,
  Table2,
  Tag,
  Target,
  Workflow,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { SCREEN_CHIP_CLASS } from "../../lesson/_components/lesson-step-text";

/**
 * What the learner does in an activity, named in a small badge above the prompt. Each renderer
 * picks one in the registry; add a kind here when a template needs a new verb.
 */
export type ActivityBadgeKind =
  | "beforeAfter"
  | "buildArgument"
  | "buildIt"
  | "buildSentence"
  | "compareSources"
  | "dragCorner"
  | "earTraining"
  | "estimateFirst"
  | "explore"
  | "exploreMap"
  | "fillSquare"
  | "findError"
  | "followKey"
  | "handsOn"
  | "labelIt"
  | "linkCauses"
  | "listen"
  | "matchPairs"
  | "moveCurve"
  | "placeInTime"
  | "placeIt"
  | "playIt"
  | "predictFirst"
  | "predictValue"
  | "putInOrder"
  | "queryData"
  | "readAndListen"
  | "readChart"
  | "reply"
  | "runCode"
  | "simulate"
  | "sortGroups"
  | "splitIt"
  | "spotPattern"
  | "stepByStep"
  | "stepThrough"
  | "tapAlong"
  | "testPattern"
  | "tryIt"
  | "turnIt"
  | "whatIf";

/** Each verb's icon: its shape says what the learner does; the chip itself stays colorless. */
const BADGE_ICONS: Record<ActivityBadgeKind, LucideIcon> = {
  beforeAfter: GitCompareArrows,
  buildArgument: Puzzle,
  buildIt: Atom,
  buildSentence: Blocks,
  compareSources: Columns2,
  dragCorner: Move,
  earTraining: Ear,
  estimateFirst: Target,
  explore: ChartSpline,
  exploreMap: MapPinned,
  fillSquare: Grid2x2Check,
  findError: ScanSearch,
  followKey: Split,
  handsOn: Hand,
  labelIt: Tag,
  linkCauses: Workflow,
  listen: Headphones,
  matchPairs: Link2,
  moveCurve: ArrowLeftRight,
  placeInTime: MoveVertical,
  placeIt: MoveHorizontal,
  playIt: Piano,
  predictFirst: Dices,
  predictValue: Target,
  putInOrder: ArrowDownUp,
  queryData: Database,
  readAndListen: Music,
  readChart: ChartLine,
  reply: MessagesSquare,
  runCode: SquareTerminal,
  simulate: Repeat,
  sortGroups: Group,
  splitIt: Grid2x2,
  spotPattern: Table2,
  stepByStep: ListOrdered,
  stepThrough: Footprints,
  tapAlong: Hand,
  testPattern: Regex,
  tryIt: SlidersHorizontal,
  turnIt: RotateCw,
  whatIf: GitBranch,
};

function useBadgeLabel(kind: ActivityBadgeKind): string {
  const t = useExtracted();

  const labels: Record<ActivityBadgeKind, string> = {
    beforeAfter: t("Before and after"),
    buildArgument: t("Build an argument"),
    buildIt: t("Build it"),
    buildSentence: t("Build the sentence"),
    compareSources: t("Compare sources"),
    dragCorner: t("Drag a corner"),
    earTraining: t("Ear training"),
    estimateFirst: t("Estimate first"),
    explore: t("Explore"),
    exploreMap: t("Explore the map"),
    fillSquare: t("Fill the square"),
    findError: t("Find the error"),
    followKey: t("Follow the key"),
    handsOn: t("Hands on"),
    labelIt: t("Label it"),
    linkCauses: t("Link causes"),
    listen: t("Listen"),
    matchPairs: t("Match pairs"),
    moveCurve: t("Move a curve"),
    placeInTime: t("Place in time"),
    placeIt: t("Place it"),
    playIt: t("Play it"),
    predictFirst: t("Predict first"),
    predictValue: t("Predict first"),
    putInOrder: t("Put in order"),
    queryData: t("Query the data"),
    readAndListen: t("Read and listen"),
    readChart: t("Read the chart"),
    reply: t("Reply"),
    runCode: t("Run the code"),
    simulate: t("Simulate"),
    sortGroups: t("Sort into groups"),
    splitIt: t("Split it"),
    spotPattern: t("Spot the pattern"),
    stepByStep: t("Step by step"),
    stepThrough: t("Step through"),
    tapAlong: t("Tap along"),
    testPattern: t("Test a pattern"),
    tryIt: t("Try it"),
    turnIt: t("Turn it"),
    whatIf: t("What if"),
  };

  return labels[kind];
}

export function ActivityBadge({ kind }: { kind: ActivityBadgeKind }) {
  const Icon = BADGE_ICONS[kind];
  const label = useBadgeLabel(kind);

  return (
    <span className={SCREEN_CHIP_CLASS} data-slot="activity-badge">
      <Icon aria-hidden="true" />
      {label}
    </span>
  );
}
