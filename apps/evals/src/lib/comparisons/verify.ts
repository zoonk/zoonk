import path from "node:path";
import { runInOrder } from "../concurrency";
import { majorClaims } from "./decision";
import { hash } from "./identity";
import { imageContent, readPacket } from "./readers";
import {
  type Comparison,
  blindOutputs,
  verificationAttemptSchema,
  verificationSchema,
} from "./schemas";
import { directory, readOptional, writeRecord } from "./storage";

export async function verifyClaims(comparison: Comparison, attempt: string) {
  const { manifest } = comparison;
  const dir = directory(manifest.taskId, manifest.id);

  const claims = majorClaims(comparison).filter((claim) => claim.source === "verification");

  await runInOrder(claims, async (claim) => {
    if (
      comparison.verifications.some(
        (verification) =>
          verification.passed &&
          verification.claims.some(
            (stored) =>
              stored.observationId === claim.id &&
              verification.response.results.some(
                (result) => result.claimId === stored.claimId && result.finding !== "unsure",
              ),
          ),
      )
    ) {
      return;
    }

    const reader = manifest.readers.find(
      (result) => result.family !== claim.reader.family && result.channel !== "owner",
    );

    if (!reader) {
      return;
    }

    const id = hash(JSON.stringify([claim.id, reader, manifest.protocols.verifier, attempt]));
    const file = path.join(dir, "verifications", `${id}.json`);

    if (await readOptional(file, verificationAttemptSchema)) {
      return;
    }

    const bank =
      manifest.controls.pairs[Number.parseInt(id.slice(0, 6), 16) % manifest.controls.pairs.length];

    if (!bank) {
      throw new Error("Missing control bank.");
    }

    const controlId = hash(`${id}false`).slice(0, 16);
    const realId = hash(`${id}real`).slice(0, 16);

    const batch = [
      {
        ...blindOutputs(bank.clean, bank.flawed),
        claim: bank.falseAllegation,
        claimId: controlId,
        criterion: bank.criterion,
        expectations: bank.expectations,
        input: bank.input,
        location: { detail: "Across the explanation", kind: "whole" },
        output: "A",
      },
      {
        ...blindOutputs(claim.pair.A, claim.pair.B),
        claim: claim.observation.claim,
        claimId: realId,
        criterion: claim.observation.criterion,
        expectations: claim.pair.expectations,
        input: claim.pair.input,
        location: claim.observation.location,
        output: claim.observation.output,
      },
    ].toSorted((left, right) => left.claimId.localeCompare(right.claimId));

    const packet = JSON.stringify(batch);

    const { response, costUsd, channel } = await readPacket({
      content: imageContent({
        entries: batch,
        identify: (entry) => entry.claimId,
        outputs: comparison.outputs,
      }),
      packet,
      protocol: manifest.protocols.verifier,
      reader,
      schema: verificationSchema,
    });

    const passed =
      response.results.length === 2 &&
      response.results.some(
        (result) => result.claimId === controlId && result.finding === "doesn't hold",
      ) &&
      response.results.some((result) => result.claimId === realId);

    await writeRecord(file, verificationAttemptSchema, {
      claims: [
        {
          caseId: claim.caseId,
          claimId: realId,
          criterion: claim.observation.criterion,
          observationId: claim.id,
          run: claim.run,
          side: claim.side,
        },
      ],
      costUsd,
      id,
      packet,
      passed,
      protocolHash: hash(manifest.protocols.verifier),
      reader: { ...reader, channel },
      response,
    });
  });
}
