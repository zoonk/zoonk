import { Fold } from "@/components/fold";
import { ReadableOutput } from "./readable-output";

/** A case's expectations as items: a test case writes them as "- " lines or as one paragraph. */
function expectationItems(expectations: string): string[] {
  return expectations
    .split(/^\s*- /mu)
    .map((item) => item.replaceAll(/\s+/gu, " ").trim())
    .filter(Boolean);
}

function Expectations({ expectations }: { expectations: string }) {
  const items = expectationItems(expectations);

  if (items.length < 2) {
    return <p>{items[0]}</p>;
  }

  return (
    <ul className="flex list-disc flex-col gap-1 ps-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

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
      <div className="flex flex-col gap-1 text-sm">
        <p className="text-muted-foreground">Must get right</p>
        <Expectations expectations={expectations} />
      </div>
      <Fold title="What the writer was given">
        <div className="bg-muted rounded-xl p-4">
          <ReadableOutput text={JSON.stringify(input)} />
        </div>
      </Fold>
    </div>
  );
}
