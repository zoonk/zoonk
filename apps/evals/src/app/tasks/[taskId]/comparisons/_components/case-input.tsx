import { Fold } from "@/components/fold";
import { ReadableOutput } from "./readable-output";

/** What a case must get right, with what the writer was given folded under it. */
export function CaseInput({
  expectations,
  input,
}: {
  expectations: string;
  input: Record<string, unknown>;
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-2">
      <p className="text-sm">
        <span className="text-muted-foreground">Must get right: </span>
        {expectations}
      </p>
      <Fold title="What the writer was given">
        <div className="bg-muted rounded-xl p-4">
          <ReadableOutput text={JSON.stringify(input)} />
        </div>
      </Fold>
    </div>
  );
}
