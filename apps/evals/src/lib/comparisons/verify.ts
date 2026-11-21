import path from "node:path";
import { decisiveClaims } from "./decision";
import { verifiedClaims } from "./evidence";
import { hash } from "./identity";
import { imageContent, readPacket } from "./readers";
import {
  type Comparison,
  type Manifest,
  type Reader,
  blindOutputs,
  verificationAttemptSchema,
  verificationSchema,
} from "./schemas";
import { directory, readOptional, writeRecord } from "./storage";

type Claim = ReturnType<typeof decisiveClaims>[number];

function verificationControls(bank: Manifest["controls"]["pairs"][number], id: string) {
  const cleanFirst = Number.parseInt(id.at(-1) ?? "0", 16) % 2 === 0;

  const expected = [
    {
      claim: bank.falseAllegation,
      finding: "doesn't hold",
      kind: "false",
      output: cleanFirst ? "A" : "B",
    },
    { claim: bank.defect, finding: "holds", kind: "planted", output: cleanFirst ? "B" : "A" },
  ]
    .map(({ kind, ...entry }) => ({ ...entry, claimId: hash(id + kind).slice(0, 16) }))
    .toSorted((first, second) => first.claimId.localeCompare(second.claimId));

  return {
    expected,
    pair: {
      ...blindOutputs(cleanFirst ? bank.clean : bank.flawed, cleanFirst ? bank.flawed : bank.clean),
      claims: expected.map(({ claim, claimId, output }) => ({
        claim,
        claimId,
        criterion: bank.criterion,
        location: { detail: "Across the explanation", kind: "whole" },
        output,
      })),
      expectations: bank.expectations,
      input: bank.input,
    },
  };
}

async function verifyBatch(
  comparison: Comparison,
  claims: Claim[],
  reader: Reader,
  attempt: string,
  related: Claim[] = [],
) {
  const first = claims[0];

  if (!first) {
    throw new Error("Missing verification claims.");
  }

  const { manifest } = comparison;

  const id = hash(
    JSON.stringify([
      claims.map((claim) => claim.id),
      related.map((claim) => claim.id),
      reader,
      manifest.protocols.verifier,
      "planted-defect-control",
      attempt,
    ]),
  );

  const file = path.join(directory(manifest.taskId, manifest.id), "verifications", `${id}.json`);

  if (await readOptional(file, verificationAttemptSchema)) {
    return null;
  }

  const bank =
    manifest.controls.pairs[Number.parseInt(id.slice(0, 6), 16) % manifest.controls.pairs.length];

  if (!bank) {
    throw new Error("Missing control bank.");
  }

  const { expected, pair: control } = verificationControls(bank, id);
  const real = first.pair;

  const claimId = (claim: Claim) => hash(id + claim.id).slice(0, 16);

  const stored = claims.map((claim) => ({
    caseId: claim.caseId,
    claimId: claimId(claim),
    criterion: claim.observation.criterion,
    observationId: claim.id,
    run: claim.run,
    side: claim.side,
  }));

  const allegations = claims.map((claim) => ({
    claim: claim.observation.claim,
    claimId: claimId(claim),
    criterion: claim.observation.criterion,
    location: claim.observation.location,
    output: (claim.side === first.side) === (first.observation.output === "A") ? "A" : "B",
  }));

  const batch = [
    control,
    {
      ...blindOutputs(real.A, real.B),
      claims: allegations,
      expectations: real.expectations,
      input: real.input,
      ...(related.length > 0 && {
        relatedObservations: related.map((claim) => ({
          claim: claim.observation.claim,
          output: (claim.side === first.side) === (first.observation.output === "A") ? "A" : "B",
        })),
      }),
    },
  ];

  if ((expected[0]?.claimId ?? "") > claimId(first)) {
    batch.reverse();
  }

  const packet = JSON.stringify(batch);

  const { response, costUsd, channel, seatContext } = await readPacket({
    content: imageContent({
      entries: batch,
      identify: (entry) => entry.claims.map((claim) => claim.claimId).join(", "),
      outputs: comparison.outputs,
    }),
    packet,
    protocol: manifest.protocols.verifier,
    reader,
    schema: verificationSchema,
  });

  const passed =
    response.results.length === stored.length + expected.length &&
    expected.every((controlClaim) =>
      response.results.some(
        (result) =>
          result.claimId === controlClaim.claimId && result.finding === controlClaim.finding,
      ),
    ) &&
    stored.every((claim) => response.results.some((result) => result.claimId === claim.claimId));

  return writeRecord(file, verificationAttemptSchema, {
    claims: stored,
    costUsd,
    id,
    packet,
    passed,
    ...(passed && { plantedDefectPassed: true }),
    protocolHash: hash(manifest.protocols.verifier),
    reader: { ...reader, channel },
    response,
    seatContext,
  });
}

export async function verifyClaims(
  comparison: Comparison,
  attempt: string,
  attempted: Set<string>,
) {
  for (;;) {
    const deciding = decisiveClaims(comparison);
    const pending = deciding.filter((claim) => !attempted.has(claim.id));
    const first = pending[0];

    if (!first) {
      return;
    }

    const group = pending.filter(
      (claim) => claim.caseId === first.caseId && claim.run === first.run,
    );

    const readers = comparison.manifest.readers.filter(
      (reader) =>
        reader.channel !== "owner" && !reader.reserve && reader.family !== first.reader.family,
    );

    const reader =
      readers.find((candidate) =>
        group.every((claim) => claim.reader.family !== candidate.family),
      ) ?? readers[0];

    const claims = group.filter((claim) => claim.reader.family !== reader?.family);

    for (const claim of claims) {
      attempted.add(claim.id);
    }

    if (reader) {
      const related = verifiedClaims(comparison).filter(
        (claim) =>
          claim.caseId === first.caseId &&
          claim.run === first.run &&
          claim.reader.family === reader.family &&
          claims.some((entry) => entry.observation.criterion === claim.observation.criterion),
      );
      // Each finding can eliminate the need for the next call.
      // oxlint-disable-next-line no-await-in-loop
      const receipt = await verifyBatch(comparison, claims, reader, attempt, related);

      if (receipt) {
        comparison.verifications.push(receipt);
      }
    }
  }
}
