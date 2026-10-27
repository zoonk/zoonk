import {
  CELEBRATION_LADDER,
  CHARACTER_RULES,
  CHOREOGRAPHY_RULES,
  MOTION_DURATIONS,
  MOTION_EASINGS,
  MOTION_PATTERNS,
  MOTION_TIERS,
  type MotionPattern,
  type MotionToken,
  NEVER_RULES,
  PERFORMANCE_RULES,
} from "@/design-system/motion";
import { type MotionDuration, type MotionEasing } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";
import { type Metadata } from "next";
import { DocHeader, DocRules, DocSection, renderCode } from "../_components/doc";
import { MotionSpecimen } from "../_components/motion-specimen";
import { BurstDemo, CountDemo, FillDemo, SettleDemo } from "./_components/celebration-demos";
import { EasingCurve } from "./_components/easing-curve";
import { PressDemo, StateDemo } from "./_components/feedback-demos";
import { MomentDemo } from "./_components/moment-demo";
import { MotionPreview } from "./_components/motion-preview";
import { TokenValue } from "./_components/token-value";

export const metadata: Metadata = { title: "Motion" };

const DEMOS: Record<string, () => React.ReactNode> = {
  burst: BurstDemo,
  count: CountDemo,
  fill: FillDemo,
  press: PressDemo,
  settle: SettleDemo,
  state: StateDemo,
};

/** Each easing beside the duration it usually runs in. */
const EASING_DURATION: Record<string, { duration: MotionDuration; easing: MotionEasing }> = {
  "--ease-out": { duration: "fill", easing: "out" },
  "--ease-spring": { duration: "settle", easing: "spring" },
};

const TABLE_ROW_BASE = "grid gap-x-6 gap-y-1 border-t py-3 text-sm leading-6";

/** A token table's columns: the token, what it's for, what reduced motion makes of it. */
const TOKEN_COLUMNS = "lg:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)]";

function TokenRow({ token, value }: { token: MotionToken; value: React.ReactNode }) {
  return (
    <div className={cn(TABLE_ROW_BASE, TOKEN_COLUMNS)} role="row">
      <div className="flex flex-col gap-1" role="rowheader">
        <span className="font-medium">{token.name}</span>
        <code className="font-mono text-xs">{token.utility}</code>
        {value}
      </div>
      <p role="cell">{renderCode(token.use)}</p>
      <p className="text-muted-foreground" role="cell">
        {renderCode(token.reduced)}
      </p>
    </div>
  );
}

function TokenTable({ children }: React.PropsWithChildren) {
  return (
    <div className="flex flex-col" role="table">
      <div
        className={cn("text-faint hidden gap-x-6 pb-2 text-xs lg:grid", TOKEN_COLUMNS)}
        role="row"
      >
        <span role="columnheader">Token</span>
        <span role="columnheader">What it&apos;s for</span>
        <span role="columnheader">With reduced motion</span>
      </div>
      {children}
    </div>
  );
}

function PatternFacts({ pattern }: { pattern: MotionPattern }) {
  const facts = [
    { label: "How", text: pattern.how },
    { label: "Reduced motion", text: pattern.reduced },
    { label: "Where", text: pattern.where },
  ];

  return (
    <dl className="max-w-column grid gap-x-4 gap-y-1.5 text-sm leading-6 sm:grid-cols-[8rem_minmax(0,1fr)]">
      {facts.map((fact) => (
        <div className="contents" key={fact.label}>
          <dt className="text-muted-foreground">{fact.label}</dt>
          <dd>{renderCode(fact.text)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The ladder's columns: the moment, how often it comes, how it moves. */
const LADDER_COLUMNS = "lg:grid-cols-[14rem_10rem_minmax(0,1fr)]";

function LadderTable() {
  return (
    <div className="flex flex-col" role="table">
      <div
        className={cn("text-faint hidden gap-x-6 pb-2 text-xs lg:grid", LADDER_COLUMNS)}
        role="row"
      >
        <span role="columnheader">Moment</span>
        <span role="columnheader">How often</span>
        <span role="columnheader">How it moves</span>
      </div>
      {CELEBRATION_LADDER.map((step) => (
        <div className={cn(TABLE_ROW_BASE, LADDER_COLUMNS)} key={step.moment} role="row">
          <span className="font-medium" role="rowheader">
            {step.moment}
          </span>
          <span className="text-muted-foreground" role="cell">
            {step.often}
          </span>
          <span role="cell">{step.how}</span>
        </div>
      ))}
    </div>
  );
}

function Tiers() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {MOTION_TIERS.map((tier) => (
        <section className="ring-border flex flex-col gap-3 rounded-xl p-5 ring-1" key={tier.id}>
          <h3 className="font-semibold">{tier.title}</h3>
          <p className="text-muted-foreground text-sm leading-6">{tier.summary}</p>
          <DocRules rules={tier.rules} />
        </section>
      ))}
    </div>
  );
}

export default function MotionPage() {
  return (
    <>
      <DocHeader title="Motion">
        Zoonk stays still, so the few things that move mean something. Everyday screens never
        animate their content in; feedback answers an action in a moment and never overshoots; only
        what&apos;s earned celebrates, once, with a spring, a number counting up or a burst. The
        buddy and the Trickster hold still until they can act. How to apply it: the `zoonk-motion`
        skill.
      </DocHeader>

      <MotionPreview>
        <DocSection title="When things move">
          <Tiers />
        </DocSection>

        <DocSection
          intro="A celebration's size follows how often it comes, so it still feels good the hundredth time."
          title="Louder as it's rarer"
        >
          <LadderTable />
        </DocSection>

        <DocSection
          intro="Values from `globals.css`, as this page resolves them (flip the switch to see the reduced ones). Every Tailwind transition takes the quick time and the ease-out by default."
          title="Durations"
        >
          <TokenTable>
            {MOTION_DURATIONS.map((token) => (
              <TokenRow
                key={token.cssVariable}
                token={token}
                value={<TokenValue variable={token.cssVariable} />}
              />
            ))}
          </TokenTable>
        </DocSection>

        <DocSection
          intro="Each curve as the browser runs it; the dashed line is the end value, so the spring's overshoot shows."
          title="Easings"
        >
          <TokenTable>
            {MOTION_EASINGS.map((token) => {
              const curve = EASING_DURATION[token.cssVariable];

              return (
                <TokenRow
                  key={token.cssVariable}
                  token={token}
                  value={curve && <EasingCurve {...curve} />}
                />
              );
            })}
          </TokenTable>
        </DocSection>

        {MOTION_PATTERNS.map((pattern) => {
          const Demo = DEMOS[pattern.id];

          return (
            <DocSection
              id={pattern.id}
              intro={`“${pattern.communicates}”`}
              key={pattern.id}
              title={pattern.title}
            >
              {Demo && (
                <MotionSpecimen>
                  <Demo />
                </MotionSpecimen>
              )}
              <PatternFacts pattern={pattern} />
            </DocSection>
          );
        })}

        <DocSection
          intro="A lesson's end that reached a level and a tenth of Energy: Brain Power counts up, the level lands as its tick fills, then Energy's bolt pops."
          title="A moment, in order"
        >
          <MotionSpecimen>
            <MomentDemo />
          </MotionSpecimen>
          <DocRules rules={CHOREOGRAPHY_RULES} />
        </DocSection>

        <DocSection
          intro="The buddy and the Trickster are characters, not objects: they show a feeling with their face and body, never by moving as one block."
          title="Characters"
        >
          <DocRules rules={CHARACTER_RULES} />
        </DocSection>

        <DocSection title="Never">
          <DocRules rules={NEVER_RULES} />
        </DocSection>

        <DocSection title="Fast on every phone">
          <DocRules rules={PERFORMANCE_RULES} />
        </DocSection>
      </MotionPreview>
    </>
  );
}
