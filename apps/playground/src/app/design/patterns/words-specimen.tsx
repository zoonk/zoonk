import { Button } from "@zoonk/ui/components/button";

const OFFER_BEFORE = [
  "Quick questions on your subjects, the ones that count most first. Your answers help your plan skip what you already know and suggest where to focus.",
  "There's no grade. \"I don't know yet\" is a useful answer.",
  "Stop whenever you need to. We save each answer.",
  "Your plan considers all 18 subjects. This sitting has up to 15 questions, so some subjects may not be checked.",
];

function OfferFrame({
  children,
  count,
  label,
}: React.PropsWithChildren<{ count: string; label: string }>) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-baseline justify-between gap-3 text-sm font-medium">
        {label}
        <span className="text-muted-foreground font-mono text-xs font-normal">{count}</span>
      </figcaption>
      <div className="bg-muted/60 flex flex-col gap-3 rounded-xl p-5">{children}</div>
    </figure>
  );
}

function OfferActions({ start }: { start: string }) {
  return (
    <div className="flex flex-col gap-1 pt-3">
      <Button size="lg">{start}</Button>
      <Button size="lg" variant="ghost">
        Skip for now
      </Button>
    </div>
  );
}

/** One screen, before and after the rule: an exam learner is offered a short test. */
export function WordsSpecimen() {
  return (
    <div className="grid items-start gap-6 sm:grid-cols-2">
      <OfferFrame count="7 text blocks, about 85 words" label="Before">
        <p className="text-title text-balance">Let&apos;s find where your study time should go</p>
        <p className="text-muted-foreground text-sm text-pretty">{OFFER_BEFORE[0]}</p>
        <p className="text-lg font-semibold">About 15 min</p>
        <p className="text-muted-foreground font-mono text-xs">
          Optional · Up to 15 questions · 18 subjects
        </p>
        {OFFER_BEFORE.slice(1).map((line) => (
          <p className="text-muted-foreground text-sm text-pretty" key={line}>
            {line}
          </p>
        ))}
        <OfferActions start="Start the test" />
      </OfferFrame>

      <OfferFrame count="3 text blocks, about 20 words" label="After">
        <p className="text-title text-balance">Skip what you already know</p>
        <p className="text-muted-foreground text-sm text-pretty">
          A short test shows what you know, so your plan starts in the right place.
        </p>
        <p className="text-muted-foreground font-mono text-xs">15 min · Optional</p>
        <OfferActions start="Start" />
      </OfferFrame>
    </div>
  );
}
