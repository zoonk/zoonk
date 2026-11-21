import { DETECTOR_SCAN_PLOT } from "./plot-visuals";

const FINE_SCAN = {
  kind: "plot" as const,
  references: [{ label: "Needed tonight", y: 960 }],
  series: [
    {
      mark: "lineWithPoints" as const,
      name: "Fine scan",
      points: [
        { label: null, x: 1.5, y: 880 },
        { label: null, x: 2, y: 930 },
        { label: null, x: 2.25, y: 968 },
        { label: null, x: 2.5, y: 992 },
        { label: null, x: 2.75, y: 975 },
        { label: null, x: 3, y: 952 },
        { label: null, x: 3.25, y: 925 },
        { label: null, x: 3.5, y: 905 },
        { label: null, x: 4, y: 893 },
        { label: null, x: 4.5, y: 890 },
      ],
    },
  ],
  source: null,
  title: "Finer scan, B to D",
  xLabel: "Detector position",
  xUnit: "mm",
  yLabel: "Count rate",
  yUnit: "counts/s",
};

function detectorDecision() {
  return {
    choices: [
      {
        effects: [{ change: -20, meter: "signal" }],
        id: "park-c",
        next: "fine",
        notes: [
          {
            kind: "improve" as const,
            skill: "reading",
            text: "Five points 1 mm apart can't show where the real peak is.",
          },
        ],
        quality: "weak" as const,
        replies: [
          { from: "lead", text: "Before we lock it at C, let the AI scan finer between B and D." },
        ],
        text: "Park it at C, where the count peaks",
      },
      {
        effects: [
          { change: -10, meter: "beam" },
          { change: 20, meter: "signal" },
        ],
        id: "fine-scan",
        next: "fine",
        notes: [
          {
            kind: "good" as const,
            skill: "reading",
            text: "You checked between the points before trusting the highest one.",
          },
        ],
        quality: "strong" as const,
        replies: [{ from: "ai", text: "Done. Here's the finer scan between B and D." }],
        text: "Scan again in finer steps from B to D",
      },
      {
        effects: [{ change: -30, meter: "signal" }],
        id: "park-a",
        next: "fine",
        notes: [
          {
            kind: "improve" as const,
            skill: "reading",
            text: "A has the lowest count on the chart, so it gives the weakest signal.",
          },
        ],
        quality: "weak" as const,
        replies: [
          {
            from: "lead",
            text: "A is our weakest spot. Let the AI scan finer between B and D first.",
          },
        ],
        text: "Park it at A, where the noise is lowest",
      },
    ],
    id: "start",
    messages: [
      {
        from: "lead",
        text: "Scan's done. We get one night of beam, so the detector stays in one spot.",
      },
      { from: "postdoc", text: "C has the highest count. I'd park it there and go home." },
    ],
    prompt: "Where do you put the detector for the night?",
    visual: DETECTOR_SCAN_PLOT,
  };
}

function fineDecision() {
  return {
    choices: [
      {
        effects: [{ change: 20, meter: "signal" }],
        id: "park-peak",
        next: "clean-run",
        notes: [
          {
            kind: "good" as const,
            skill: "reading",
            text: "You read the peak off the finer scan, not the coarse one.",
          },
        ],
        quality: "strong" as const,
        replies: [{ from: "lead", text: "2.5 mm it is. Good catch." }],
        text: "Park it at the new peak, at 2.5 mm",
      },
      {
        effects: [{ change: -10, meter: "signal" }],
        id: "park-c-anyway",
        next: "missed-peak",
        notes: [
          {
            kind: "improve" as const,
            skill: "reading",
            text: "The finer scan peaks at 2.5 mm, and C falls under the count you needed.",
          },
        ],
        quality: "fair" as const,
        replies: [],
        text: "Stay with C at 3 mm",
      },
    ],
    id: "fine",
    messages: [{ from: "lead", text: "We need at least 960 counts a second for a clean run." }],
    prompt: "Where does the detector go?",
    visual: FINE_SCAN,
  };
}

export function challengeChartCaseFixture() {
  return {
    endings: [
      { id: "clean-run", outcome: "The run hit 990 counts a second all night: a clean data set." },
      {
        id: "missed-peak",
        outcome: "The detector sat off the peak. The night's data came out too thin to publish.",
      },
    ],
    meters: [
      { goodWhen: "high" as const, id: "beam", label: "Beam time left", start: 90 },
      { goodWhen: "high" as const, id: "signal", label: "Signal quality", start: 50 },
    ],
    mission: "Pick **one spot** for the detector so tonight's run gets the strongest signal.",
    nodes: [detectorDecision(), fineDecision()],
    panels: [],
    setting: "Beamline 4, 6 pm",
    skills: [
      {
        id: "reading",
        name: "Reading a scan",
        practice: "Before trusting the highest point, ask what happens between the points.",
      },
    ],
    startNodeId: "start",
    team: [
      { ai: false, expertise: "Runs the beamline schedule", id: "lead", role: "Lab lead" },
      { ai: false, expertise: "Set up the detector", id: "postdoc", role: "Postdoc" },
      { ai: true, expertise: "Runs scans when asked", id: "ai", role: "AI assistant" },
    ],
    title: "Where should the detector sit tonight?",
    variant: "work" as const,
  };
}

export const CHALLENGE_CHART_STRONG_PATH = ["fine-scan", "park-peak"];
