import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCallsCost } from "@/lib/cost";
import { type TaskModelOutputResults } from "@/lib/types";
import { type AblationReaderFile } from "@/tasks/grade-essay-blind-key/ablation-marks";
import { BLIND_KEYS_FILE, type BlindKeyFile } from "@/tasks/grade-essay-blind-key/blind-keys";
import {
  type GradedAnswer,
  type Range,
  getAnswerResidual,
  getHeldOutCalls,
  getMargins,
  getPointsGate,
  getStrata,
  getStratumCoverage,
  isBelowCutoff,
  isRankable,
} from "@/tasks/grade-essay-blind-key/calibration";
import { TEST_CASES as BLIND_CASES } from "@/tasks/grade-essay-blind-key/test-cases";
import { type GradeWritingOutput } from "@/tasks/grade-essay/task";
import { TEST_CASES as BOARD_CASES } from "@/tasks/grade-essay/test-cases";
import { GATEWAY_PRICES } from "@zoonk/ai/pricing/call-cost";
import { getWritingGrader } from "@zoonk/ai/tasks/grading/grade-essay";
import { getWritingKeyWriter } from "@zoonk/ai/tasks/items/write-writing-prompt";
import { getPromptVersion } from "@zoonk/utils/prompt-version";

function print(line = "") {
  process.stdout.write(`${line}\n`);
}

const GRADER = "meta-muse-ember:high";
const LEVELS = [0.9, 0.95];

const CALL_ERROR_PER_PART = 0.1;
const CGU_WRITTEN_ITEMS = 2;
const CALL_LEVEL = 1 - CALL_ERROR_PER_PART / CGU_WRITTEN_ITEMS;
const MIN_REAL_BELOW = 6;
const MIN_COVERAGE = 0.8;
const MAX_MARGIN_SUM = 1 / 3;

const OUTPUT = "eval-results/blind-keys/keyed-calibration.json";

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(process.cwd(), file), "utf8")) as T;
}

async function readOutputs(task: string) {
  return readJson<TaskModelOutputResults>(`eval-results/outputs/${task}/${GRADER}.json`);
}

function runsByCase(outputs: TaskModelOutputResults) {
  const runs = new Map<string, Range[]>();
  const prompts = new Map<string, Set<string>>();

  for (const entry of outputs.outputs) {
    const caseId = entry.testCaseId.replace(/-\d+$/u, "");
    const { result } = JSON.parse(entry.output) as GradeWritingOutput;
    const total = result.kind === "points" ? result.total : { high: 0, low: 0 };
    runs.set(caseId, [...(runs.get(caseId) ?? []), total]);

    prompts.set(
      caseId,
      (prompts.get(caseId) ?? new Set()).add(
        getPromptVersion({ systemPrompt: entry.systemPrompt }),
      ),
    );
  }

  return { prompts, runs };
}

const fixed = (value: number | null | undefined, digits = 3) =>
  value === null || value === undefined ? "—" : value.toFixed(digits);

const percent = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${(value * 100).toFixed(1)}%`;

function table(header: string[], rows: (string | number)[][]) {
  print(`| ${header.join(" | ")} |`);
  print(`| ${header.map(() => "---").join(" | ")} |`);

  for (const row of rows) {
    print(`| ${row.join(" | ")} |`);
  }

  print();
}

function strataTable(answers: GradedAnswer[]) {
  table(
    [
      "Stratum",
      "Answers",
      "Runs",
      "Below cutoff",
      "Median |error|",
      "Within 20%",
      "Mean signed",
      "Max over",
      "Max under",
      "Points gate",
    ],
    [...getStrata(answers).entries()].map(([stratum, members]) => {
      const gate = getPointsGate(members);
      const residuals = members.map((answer) => getAnswerResidual(answer));

      return [
        stratum,
        members.length,
        gate.runs,
        members.filter((answer) => isBelowCutoff(answer)).length,
        percent(gate.medianError),
        percent(gate.within),
        percent(gate.meanSigned),
        fixed(Math.max(...residuals.map(({ over }) => over))),
        fixed(Math.max(...residuals.map(({ under }) => under))),
        gate.passes ? "pass" : "FAIL",
      ];
    }),
  );
}

function marginsTable(answers: GradedAnswer[]) {
  const real = answers.filter(({ kind }) => kind === "real");

  table(
    ["Level", "Pooled real n", "Over", "Under", "Over + under", "Widened by (too small to rank)"],
    LEVELS.map((level) => {
      const margins = getMargins(answers, level);

      const small = [...getStrata(answers).entries()]
        .filter(([, members]) => !isRankable(members.length, level))
        .map(([stratum, members]) => `${stratum} (${members.length})`);

      return [
        level,
        real.length,
        margins ? fixed(margins.over) : "abstain",
        margins ? fixed(margins.under) : "abstain",
        margins ? fixed(margins.over + margins.under) : "abstain",
        small.join(", ") || "none",
      ];
    }),
  );
}

function residualRows(answers: GradedAnswer[]) {
  table(
    ["Answer", "Board", "Max", "Cutoff", "Runs (low–high)", "Over", "Under"],
    answers.map((answer) => {
      const residual = getAnswerResidual(answer);

      const board =
        answer.board.low === answer.board.high
          ? `${answer.board.low}`
          : `${answer.board.low}–${answer.board.high}`;

      return [
        answer.id,
        board,
        answer.max,
        answer.cutoffShare === null
          ? "—"
          : `${answer.cutoffShare * answer.max}${isBelowCutoff(answer) ? " (below)" : ""}`,
        answer.runs
          .map((run) => (run.low === run.high ? `${run.low}` : `${run.low}–${run.high}`))
          .join(", "),
        fixed(residual.over),
        fixed(residual.under),
      ];
    }),
  );
}

function callGate(answers: GradedAnswer[]) {
  const margins = getMargins(answers, CALL_LEVEL);
  const below = answers.filter((answer) => isBelowCutoff(answer));
  const realBelow = below.filter(({ kind }) => kind === "real");
  const ablationBelow = below.filter(({ kind }) => kind === "ablation");
  const heldOut = getHeldOutCalls(answers, CALL_LEVEL);

  const falseAbove = heldOut.flatMap(({ answer, calls }) =>
    calls.filter((call) => call === "above").map(() => answer.id),
  );

  const coverage = getStratumCoverage(answers, CALL_LEVEL);

  const coverageOk = coverage.every(
    ({ over, under }) =>
      over !== null && under !== null && over >= MIN_COVERAGE && under >= MIN_COVERAGE,
  );

  const checks = [
    {
      detail: margins ? `over ${fixed(margins.over)}, under ${fixed(margins.under)}` : "abstains",
      name: `Margins rankable at ${CALL_LEVEL}`,
      pass: margins !== null,
    },
    {
      detail: `${realBelow.length} real (${realBelow.map(({ stratum }) => stratum).join(", ") || "none"}); ${ablationBelow.length} ablations of strong answers`,
      name: `≥ ${MIN_REAL_BELOW} real answers below cutoff, plus ablations`,
      pass: realBelow.length >= MIN_REAL_BELOW && ablationBelow.length > 0,
    },
    {
      detail: `${falseAbove.length} of ${heldOut.reduce((sum, { calls }) => sum + calls.length, 0)} held-out runs${falseAbove.length > 0 ? `: ${[...new Set(falseAbove)].join(", ")}` : ""}`,
      name: "Zero false “likely above” on held-out below-cutoff runs",
      pass: falseAbove.length === 0,
    },
    {
      detail: margins ? fixed(margins.over + margins.under) : "abstains",
      name: "Over + under ≤ 1/3 of max",
      pass: margins !== null && margins.over + margins.under <= MAX_MARGIN_SUM + 1e-9,
    },
    {
      detail: coverage
        .map(({ over, stratum, under }) => `${stratum} ${percent(over)}/${percent(under)}`)
        .join("; "),
      name: `Held-out stratum covered ≥ ${MIN_COVERAGE * 100}% per side`,
      pass: coverageOk,
    },
  ];

  table(
    ["Call gate check", "Result", "Detail"],
    checks.map(({ detail, name, pass }) => [name, pass ? "pass" : "FAIL", detail]),
  );

  table(
    ["Below-cutoff answer", "Held-out margins (over/under)", "Calls per run"],
    heldOut.map(({ answer, calls, margins: held }) => [
      answer.id,
      held ? `${fixed(held.over)}/${fixed(held.under)}` : "abstain",
      calls.join(", "),
    ]),
  );

  return checks;
}

function boardAnswers(prefix: (id: string) => string | null, runs: Map<string, Range[]>) {
  return BOARD_CASES.flatMap((testCase): GradedAnswer[] => {
    const stratum = prefix(testCase.id);
    const official = testCase.expected?.officialTotal;
    const caseRuns = runs.get(testCase.id);

    if (!stratum || official === undefined || !caseRuns) {
      return [];
    }

    const enem = testCase.userInput.basis.grading.criteria.some(({ awards }) => awards);

    return [
      {
        board: { high: official, low: official },
        cutoffShare: enem ? null : 0.6,
        id: testCase.id,
        kind: "real",
        max: testCase.userInput.basis.points ?? (enem ? 1000 : 0),
        runs: caseRuns,
        sourceQuestion: testCase.id.replace(/-\d+-pt$/u, "").replace(/-pt$/u, ""),
        stratum,
      },
    ];
  });
}

function keyedStratum(id: string) {
  if (id.startsWith("fgv-oab-")) {
    return "fgv-oab";
  }

  return id.startsWith("cebraspe-cacd-") && id.includes("-history-") ? "cacd-history" : null;
}

function enemStratum(id: string) {
  return (
    ["enem-inep", "enem-published", "enem-research"].find((prefix) => id.startsWith(prefix)) ?? null
  );
}

function sortedShares(answers: GradedAnswer[], side: "over" | "under") {
  return answers
    .filter(({ kind }) => kind === "real")
    .map((answer) => getAnswerResidual(answer)[side])
    .toSorted((a, b) => a - b);
}

function meanEstimate(runs: Range[] | undefined) {
  return runs
    ? fixed(runs.reduce((sum, run) => sum + (run.low + run.high) / 2, 0) / runs.length, 2)
    : "—";
}

const unique = (values: (string | undefined)[]) => [...new Set(values)].join(", ");

async function printProvenance({
  keys,
  outputs,
  prompts,
}: {
  keys: BlindKeyFile;
  outputs: TaskModelOutputResults;
  prompts: Map<string, Set<string>>;
}) {
  const readers = await readJson<AblationReaderFile>(
    "eval-results/blind-keys/ablation-readers.json",
  );

  const gradingSpent = getCallsCost({
    calls: outputs.outputs.flatMap(({ calls }) => calls ?? []),
    prices: GATEWAY_PRICES,
  });

  const total = keys.spentUsd + readers.spentUsd + gradingSpent;
  const saved = unique([...prompts.values()].flatMap((set) => [...set]));
  const grader = getWritingGrader();

  print("# Written grades against blind keys\n");

  print(
    `Spend: keys $${keys.spentUsd.toFixed(4)}, ablation readers $${readers.spentUsd.toFixed(4)}, grading $${gradingSpent.toFixed(4)}; total $${total.toFixed(4)}.`,
  );

  print(`Grader ${grader.model} (high), prompt ${grader.promptVersion}; saved runs used ${saved}.`);

  print(
    `Writer ${unique(keys.keys.map(({ model }) => model))}, template revision ${unique(keys.keys.map(({ promptRevision }) => promptRevision))} (current ${getWritingKeyWriter().promptVersion}).\n`,
  );
}

function printKeyed(keyed: GradedAnswer[]) {
  print("## Keyed mechanism, blind keys (every key draw pooled per answer)\n");
  strataTable(keyed);
  marginsTable(keyed);
  print(`### Call gate (level ${CALL_LEVEL}, k = ${CGU_WRITTEN_ITEMS})\n`);
  const checks = callGate(keyed);
  print("### Residuals per answer (worst run across every key draw, share of the question)\n");
  residualRows(keyed);
  return checks;
}

function printComparison(keyed: GradedAnswer[], boardKeyed: GradedAnswer[]) {
  const real = keyed.filter(({ kind }) => kind === "real");

  print("## Board key vs blind key, same real answers\n");
  print("Board key (saved grade-essay runs):\n");
  strataTable(boardKeyed);
  marginsTable(boardKeyed);
  print("Blind key:\n");
  strataTable(real);
  marginsTable(real);

  table(
    ["Answer", "Board", "Board key (mean)", "Blind key (mean)"],
    boardKeyed.map((answer) => [
      answer.id,
      answer.board.low,
      meanEstimate(answer.runs),
      meanEstimate(real.find(({ id }) => `${id}-pt` === answer.id)?.runs),
    ]),
  );
}

function printEnem(enem: GradedAnswer[]) {
  print("## Enem mechanism (saved grade-essay runs, no new calls)\n");
  strataTable(enem);
  marginsTable(enem);
  print("Enem's notice sets no minimum for the redação, so it has no call gate to test.\n");
}

function buildCalibration({
  checks,
  keyed,
  keys,
}: {
  checks: ReturnType<typeof callGate>;
  keyed: GradedAnswer[];
  keys: BlindKeyFile;
}) {
  const floors = [...getStrata(keyed).entries()].map(([stratum, members]) => ({
    answers: members.length,
    over: Math.max(...members.map((answer) => getAnswerResidual(answer).over)),
    stratum,
    tooSmallAt: LEVELS.filter((level) => !isRankable(members.length, level)),
    under: Math.max(...members.map((answer) => getAnswerResidual(answer).under)),
  }));

  return {
    answers: keyed.filter(({ kind }) => kind === "real").length,
    callGate: Object.fromEntries(checks.map(({ name, pass }) => [name, pass])),
    floors,
    generatedAt: new Date().toISOString(),
    grader: {
      model: getWritingGrader().model,
      promptVersion: getWritingGrader().promptVersion,
      reasoning: "high",
    },
    keyWriter: {
      model: unique(keys.keys.map(({ model }) => model)),
      promptRevision: unique(keys.keys.map(({ promptRevision }) => promptRevision)),
    },
    margins: Object.fromEntries(LEVELS.map((level) => [level, getMargins(keyed, level)])),
    mechanism: "keyed",
    over: sortedShares(keyed, "over"),
    under: sortedShares(keyed, "under"),
  };
}

/** Draws pool as one answer: production writes one key per question per learner pool, so a draw's variance is a learner's. */
function keyedAnswers(runs: Map<string, Range[]>, draw?: number): GradedAnswer[] {
  const answers = new Map<string, GradedAnswer>();

  for (const { expected, id: caseId } of BLIND_CASES) {
    const caseRuns = runs.get(caseId);

    if (caseRuns && expected && (draw === undefined || expected.draw === draw)) {
      const id = expected.answer.replace(/-pt$/u, "");
      const known = answers.get(id);
      answers.set(id, { ...expected, id, runs: [...(known?.runs ?? []), ...caseRuns] });
    }
  }

  return [...answers.values()];
}

function printDraws(runs: Map<string, Range[]>) {
  const draws = [...new Set(BLIND_CASES.flatMap(({ expected }) => expected?.draw ?? []))];

  if (draws.length < 2) {
    return;
  }

  print("## Each key draw on its own\n");

  for (const draw of draws.toSorted((a, b) => a - b)) {
    print(`Draw ${draw}:\n`);
    strataTable(keyedAnswers(runs, draw));
  }
}

async function main() {
  const keys = await readJson<BlindKeyFile>(BLIND_KEYS_FILE);
  const blindOutputs = await readOutputs("grade-essay-blind-key");
  const blind = runsByCase(blindOutputs);
  const board = runsByCase(await readOutputs("grade-essay"));

  const keyed = keyedAnswers(blind.runs);

  await printProvenance({ keys, outputs: blindOutputs, prompts: blind.prompts });
  const checks = printKeyed(keyed);
  printDraws(blind.runs);
  printComparison(keyed, boardAnswers(keyedStratum, board.runs));
  printEnem(boardAnswers(enemStratum, board.runs));

  const calibration = buildCalibration({ checks, keyed, keys });
  await writeFile(path.join(process.cwd(), OUTPUT), `${JSON.stringify(calibration, null, 2)}\n`);
  print(`Wrote ${OUTPUT}`);
}

await main();
