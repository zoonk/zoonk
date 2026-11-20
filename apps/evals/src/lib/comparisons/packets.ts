import { randomUUID } from "node:crypto";
import path from "node:path";
import { hash, hashJson } from "./identity";
import {
  type Comparison,
  type Manifest,
  type PacketOutput,
  type Reader,
  type SealedPacket,
  attemptSchema,
  blindOutputs,
  identifier,
  manifestSchema,
  responseSchema,
  type runSchema,
} from "./schemas";
import { directory, readOptional, writeRecord } from "./storage";
import type z from "zod";

type PacketInput = Pick<
  Manifest,
  | "priorities"
  | "criteria"
  | "controls"
  | "cases"
  | "runsCompared"
  | "readers"
  | "variants"
  | "protocols"
>;

function toPacketOutput(
  slot: z.infer<typeof runSchema>["challenger"],
  outputs: Comparison["outputs"],
): PacketOutput | null {
  if (!slot) {
    return null;
  }

  const output = outputs[slot.hash];
  return Buffer.isBuffer(output) ? { image: slot.hash } : (output ?? null);
}

export function buildPackets(
  selection: PacketInput,
  outputs: Comparison["outputs"],
): SealedPacket[] {
  return selection.runsCompared.flatMap((run, index) => {
    const testCase = selection.cases.find((criterion) => criterion.id === run.caseId);
    const challenger = toPacketOutput(run.challenger, outputs);
    const incumbent = toPacketOutput(run.incumbent, outputs);

    if (!testCase || !challenger || (selection.variants.incumbent && !incumbent)) {
      return [];
    }

    return selection.readers.flatMap((reader, readerIndex) =>
      (incumbent ? [false, true] : [false]).map((reverse) => {
        const familyIndex = ["anthropic", "openai", "google", "owner"].indexOf(reader.family);
        const flip = Boolean((run.run - 1 + familyIndex + Number(reverse)) % 2);
        const first = incumbent && !flip ? "incumbent" : "challenger";
        const controlIndex = index + readerIndex + Number(reverse);

        const sameLanguage = selection.controls.pairs.filter(
          (control) => control.input.language === testCase.language,
        );

        const bankEntries = sameLanguage.length > 0 ? sameLanguage : selection.controls.pairs;
        const bank = bankEntries[controlIndex % bankEntries.length];

        if (!bank) {
          throw new Error("Missing sealed control.");
        }

        const cleanFirst = Boolean(controlIndex % 2);

        const cleanLabel = cleanFirst ? ("A" as const) : ("B" as const);

        const entries = (
          [
            {
              ...blindOutputs(
                first === "incumbent" && incumbent ? incumbent : challenger,
                (incumbent && (flip ? incumbent : challenger)) ?? null,
              ),
              expectations: testCase.expectations,
              input: testCase.input,
              kind: "real",
            },
            {
              ...blindOutputs(challenger, challenger),
              expectations: testCase.expectations,
              input: testCase.input,
              kind: "identical",
            },
            {
              ...blindOutputs(
                cleanFirst ? bank.clean : bank.flawed,
                cleanFirst ? bank.flawed : bank.clean,
              ),
              expectations: bank.expectations,
              input: bank.input,
              kind: "defect",
            },
          ] as const
        )
          .map((entry) => ({ ...entry, pairId: randomUUID() }))
          .toSorted((left, right) => left.pairId.localeCompare(right.pairId));

        const packet = {
          criteria: selection.criteria,
          pairs: entries.map((entry) => ({
            ...blindOutputs(entry.A, entry.B),
            expectations: entry.expectations,
            input: entry.input,
            pairId: entry.pairId,
          })),
          reads: selection.priorities.reads,
        };

        return {
          id: hashJson([packet, reader, selection.protocols.reader]),
          mapping: entries.map(({ kind, pairId }) => ({
            caseId: run.caseId,
            clean: kind === "defect" ? cleanLabel : null,
            criterion: kind === "defect" ? bank.criterion : null,
            first,
            kind,
            pairId,
            run: run.run,
          })),
          packet,
          reader,
          reverse,
        };
      }),
    );
  });
}
export function gradePacket(sealed: SealedPacket, response: z.infer<typeof responseSchema>) {
  const failures: string[] = [];
  const keys = sealed.packet.criteria.map((criterion) => criterion.id).toSorted();

  if (response.verdicts.length !== sealed.mapping.length) {
    failures.push("Unexpected verdict count.");
  }

  sealed.mapping.forEach((mapping) => {
    const votes = response.verdicts.filter((verdict) => verdict.pairId === mapping.pairId);
    const verdict = votes[0];

    if (votes.length !== 1 || !verdict) {
      failures.push("Missing or repeated pair.");
      return;
    }

    const audit = sealed.packet.pairs.find((item) => item.pairId === mapping.pairId)?.B === null;

    if (
      audit !== (verdict.overall === null) ||
      JSON.stringify(verdict.criteria.map((criterion) => criterion.criterion).toSorted()) !==
        JSON.stringify(audit ? [] : keys) ||
      verdict.observations.some(
        (observation) =>
          !keys.includes(observation.criterion) || (audit && observation.output === "B"),
      )
    ) {
      failures.push("Verdict does not cover the sealed criteria or outputs.");
    }

    if (
      mapping.kind === "identical" &&
      (verdict.overall?.preference !== "tie" ||
        verdict.criteria.some((criterion) => criterion.preference !== "tie"))
    ) {
      failures.push("Preferred one of two identical outputs.");
    }

    if (
      mapping.kind === "defect" &&
      (verdict.overall?.preference !== mapping.clean ||
        !verdict.observations.some(
          (observation) =>
            observation.output !== mapping.clean &&
            observation.severity === "major" &&
            observation.criterion === mapping.criterion,
        ))
    ) {
      failures.push("Missed the control bank defect.");
    }
  });

  return failures;
}
type ImportArgs = {
  taskId: string;
  id: string;
  packetId: string;
  attempt: string;
  response: unknown;
};
export async function saveResponse(args: ImportArgs, costUsd: number, channel: Reader["channel"]) {
  const dir = directory(args.taskId, args.id);
  const manifest = await readOptional(path.join(dir, "manifest.json"), manifestSchema);
  const sealed = manifest?.packets.find((item) => item.id === args.packetId);

  if (
    !manifest ||
    !sealed ||
    (sealed.reader.channel !== channel &&
      !(sealed.reader.channel === "seat" && channel === "gateway"))
  ) {
    throw new Error("Unknown packet or reader channel.");
  }

  const response = responseSchema.parse(args.response);
  const failures = gradePacket(sealed, response);

  return writeRecord(
    path.join(dir, "verdicts", `${sealed.id}-${identifier.parse(args.attempt)}.json`),
    attemptSchema,
    {
      attempt: args.attempt,
      costUsd,
      failures,
      packetId: sealed.id,
      passed: failures.length === 0,
      protocolHash: hash(manifest.protocols.reader),
      reader: { ...sealed.reader, channel },
      response,
    },
  );
}
export function importVerdicts(args: ImportArgs) {
  return saveResponse(args, 0, "owner");
}
