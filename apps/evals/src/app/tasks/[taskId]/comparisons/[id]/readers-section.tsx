import { Fold } from "@/components/fold";
import { type Decision } from "@/lib/comparisons/decision";
import { type Comparison } from "@/lib/comparisons/schemas";
import { packetCase } from "../_utils/case-evidence";
import { familyLabel, modelName } from "../_utils/labels";
import { failureLabel } from "../_utils/words";

function ownFamilyText(reader: Decision["readers"][number]): string {
  if (reader.ownOpportunities === 0) {
    return "No pair where its own family wrote one side";
  }

  return `Preferred its own family in ${reader.ownWins} of ${reader.ownOpportunities} reads`;
}

/** How far each reader can be trusted here: its own-family lean, its agreement with the owner, the checks it failed. */
export function ReadersSection({
  comparison,
  decision,
}: {
  comparison: Comparison;
  decision: Decision;
}) {
  const failed = comparison.attempts.filter((attempt) => !attempt.passed);
  const models = decision.readers.filter((reader) => reader.family !== "owner");

  return (
    <Fold title="Readers and the checks they failed">
      <div className="flex flex-col gap-4 pb-2 text-sm">
        <ul className="flex flex-col">
          {models.map((reader) => (
            <li className="flex flex-col gap-0.5 border-t py-3 first:border-t-0" key={reader.model}>
              <p>
                <span className="font-medium">{familyLabel(reader.family)}</span>{" "}
                <span className="text-muted-foreground font-mono text-xs">
                  {modelName(reader.model)}
                </span>
              </p>
              <p className="text-muted-foreground">
                {ownFamilyText(reader)} ·{" "}
                {reader.ownerCompared > 0
                  ? `agreed with you on ${reader.ownerAgrees} of ${reader.ownerCompared}`
                  : "no reads to compare with yours yet"}{" "}
                · {reader.failedPackets} failed {reader.failedPackets === 1 ? "check" : "checks"}
              </p>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-1">
          <p className="font-medium">Reads that didn’t count</p>
          <p className="text-muted-foreground text-xs">
            Each set of pairs hides two checks: the same answer twice, and one with a planted
            mistake. A set whose checks failed is kept here and left out of the outcome.
          </p>

          {failed.length === 0 ? (
            <p className="text-muted-foreground">None.</p>
          ) : (
            <ul className="flex flex-col">
              {failed.map((attempt) => {
                const packet = comparison.manifest.packets.find(
                  (entry) => entry.id === attempt.packetId,
                );

                return (
                  <li
                    className="border-t py-2 first:border-t-0"
                    key={`${attempt.packetId}-${attempt.attempt}`}
                  >
                    {familyLabel(attempt.reader.family)} on{" "}
                    <span className="font-mono text-xs">
                      {packet ? packetCase(packet) : "an unknown case"}
                    </span>
                    : {attempt.failures.map((failure) => failureLabel(failure)).join("; ")}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Fold>
  );
}
