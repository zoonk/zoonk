import { Button } from "@zoonk/ui/components/button";
import { EnterButton } from "@zoonk/ui/components/enter-button";

const HOW_IT_WORKS = [
  [
    "What counts most comes first",
    "The test starts with the subjects that weigh most in your exam.",
  ],
  ["There's no grade", "“I don't know yet” is a fine answer."],
  ["Stop anytime", "Each answer is saved."],
  [
    "Focusing never removes a subject",
    "The ones you need most get more time when your time can't cover everything.",
  ],
  [
    "A few more in your first week",
    "Your study sessions ask a few more of these questions. You can pause that.",
  ],
] as const;

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

function OfferHeading({ chip, line, title }: { chip: string; line: string; title: string }) {
  return (
    <>
      <p className="text-muted-foreground text-sm">{chip}</p>
      <p className="text-title text-balance">{title}</p>
      <p className="text-muted-foreground text-sm text-pretty">{line}</p>
    </>
  );
}

export function WordsSpecimen() {
  return (
    <div className="grid items-start gap-6 sm:grid-cols-2">
      <OfferFrame count="14 text blocks, 109 words" label="Before">
        <OfferHeading
          chip="Focus test · About 15 min"
          line="Quick questions on your exam's subjects. Your plan skips what you already know, so your time goes where you need it most."
          title="Find out where to focus"
        />
        <p className="text-sm underline underline-offset-4">How it works</p>
        <dl className="border-border flex flex-col gap-2 border-l-2 pl-3">
          {HOW_IT_WORKS.map(([title, line]) => (
            <div key={title}>
              <dt className="text-sm font-medium">{title}</dt>
              <dd className="text-muted-foreground text-sm text-pretty">{line}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-1 pt-3">
          <Button size="lg">Start the test</Button>
          <Button size="lg" variant="ghost">
            Skip for now
          </Button>
        </div>
      </OfferFrame>

      <OfferFrame count="3 text blocks, 23 words" label="After">
        <OfferHeading
          chip="Focus test · 15 min"
          line="A short test on your exam's subjects. Your plan skips what you already know."
          title="Find what to study most"
        />
        <div className="flex flex-col gap-1 pt-3">
          <EnterButton enter="host" size="lg">
            Start
          </EnterButton>
          <Button size="lg" variant="ghost">
            Skip for now
          </Button>
        </div>
      </OfferFrame>
    </div>
  );
}
