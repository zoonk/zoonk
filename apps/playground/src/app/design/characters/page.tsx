import {
  BUDDY_EXPRESSIONS,
  CHARACTER_IDLE_RULES,
  CHARACTER_LIGHT_RULES,
  CHARACTER_MOMENTS,
  CHARACTER_PARTS,
  CHARACTER_RULES,
  CHARACTER_TIMING_RULES,
  TRICKSTER_EXPRESSIONS,
} from "@/design-system/characters";
import { Buddy } from "@zoonk/ui/components/buddy";
import { Trickster } from "@zoonk/ui/components/trickster";
import { cn } from "@zoonk/ui/lib/utils";
import { type BuddyKind } from "@zoonk/utils/buddy";
import { type Metadata } from "next";
import { DocHeader, DocRules, DocSection, renderCode } from "../_components/doc";
import { ActsTable } from "./_components/acts-table";
import { BuddyStage } from "./_components/buddy-stage";
import { TricksterStage } from "./_components/trickster-stage";

export const metadata: Metadata = { title: "Characters" };

const KINDS: readonly { kind: BuddyKind; name: string }[] = [
  { kind: "zu", name: "Zu" },
  { kind: "otto", name: "Otto" },
  { kind: "noodle", name: "Noodle" },
  { kind: "beep", name: "Beep" },
];

/** Enough Energy for a glad buddy, short of its glow. */
const ENERGY = 70;

/** Energy's three faces: napping on a day without study, awake, and glowing from 80%. */
const ENERGY_STATES = [
  { energy: 12, label: "Napping, 12%", studiedToday: false },
  { energy: 55, label: "Awake, 55%", studiedToday: true },
  { energy: 95, label: "Glowing, 95%", studiedToday: true },
] as const;

function Cell({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <figure className="flex flex-col items-center gap-1 text-center">
      {children}
      <figcaption className="text-xs font-medium">{label}</figcaption>
    </figure>
  );
}

const GRID = "grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-8";

function ExpressionGrid() {
  return (
    <div className="flex flex-col gap-6">
      {KINDS.map(({ kind, name }) => (
        <div className="flex flex-col gap-2" key={kind}>
          <p className="text-muted-foreground text-xs font-medium">{name}</p>
          <div className={GRID}>
            {BUDDY_EXPRESSIONS.map((expression) => (
              <Cell key={expression.name} label={expression.label}>
                <Buddy
                  beltColor="orange"
                  className="size-20"
                  energy={ENERGY}
                  expression={expression.name}
                  kind={kind}
                  studiedToday
                />
              </Cell>
            ))}
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs font-medium">The Trickster</p>
        <div className={GRID}>
          {TRICKSTER_EXPRESSIONS.map((expression) => (
            <Cell key={expression.name} label={expression.label}>
              <Trickster className="size-20" expression={expression.name} />
            </Cell>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Each buddy at Energy's three faces: only Zu and Beep wear a light, which Energy brightens. */
function EnergyGrid() {
  return (
    <div className="grid w-fit grid-cols-2 gap-x-12 gap-y-6 sm:grid-cols-4">
      {KINDS.map(({ kind, name }) => (
        <div className="flex flex-col gap-2" key={kind}>
          <p className="text-muted-foreground text-center text-xs font-medium">{name}</p>
          <div className="flex flex-col gap-3">
            {ENERGY_STATES.map((state) => (
              <Cell key={state.energy} label={state.label}>
                <Buddy
                  beltColor="orange"
                  className="size-20"
                  energy={state.energy}
                  kind={kind}
                  studiedToday={state.studiedToday}
                />
              </Cell>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const MOMENT_COLUMNS = "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_8rem_minmax(0,1.2fr)]";
const MOMENT_ROW = "grid gap-x-6 gap-y-1 border-t py-3 text-sm leading-6";

/** Where each character reacts in the product, with the act and its beat. */
function MomentsTable() {
  return (
    <div className="flex flex-col" role="table">
      <div
        className={cn("text-faint hidden gap-x-6 pb-2 text-xs lg:grid", MOMENT_COLUMNS)}
        role="row"
      >
        <span role="columnheader">Moment</span>
        <span role="columnheader">Who</span>
        <span role="columnheader">Act</span>
        <span role="columnheader">When in the moment</span>
      </div>
      {CHARACTER_MOMENTS.map((moment) => (
        <div
          className={cn(MOMENT_ROW, MOMENT_COLUMNS)}
          key={`${moment.moment}-${moment.act}`}
          role="row"
        >
          <span className="font-medium" role="rowheader">
            {moment.moment}
          </span>
          <span className="text-muted-foreground" role="cell">
            {moment.character}
          </span>
          <span role="cell">{moment.act}</span>
          <span className="text-muted-foreground" role="cell">
            {moment.beat}
          </span>
        </div>
      ))}
    </div>
  );
}

const DEFINITION =
  "grid gap-x-6 gap-y-1 border-t py-3 text-sm leading-6 lg:grid-cols-[18rem_minmax(0,1fr)]";

function Definitions({ items }: { items: readonly { term: string; text: string }[] }) {
  return (
    <dl className="flex flex-col">
      {items.map((item) => (
        <div className={cn(DEFINITION)} key={item.term}>
          <dt className="font-medium">{renderCode(item.term)}</dt>
          <dd className="text-muted-foreground">{renderCode(item.text)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function CharactersPage() {
  return (
    <>
      <DocHeader title="Characters">
        How the buddy and the Trickster act: their parts move (eyes first, then the mouth, the head
        and the limbs, loose parts last), never the whole drawing at once. The rig is part of the
        real components, and every act here plays in the product, once, where something happened
        (Moments, below); everywhere else the characters hold still.
      </DocHeader>

      <DocSection
        intro="Each act plays from its own start. Slow it to 10% to judge it frame by frame; with reduced motion an act only changes the face."
        title="Acting"
      >
        <div className="grid gap-4 xl:grid-cols-3">
          <BuddyStage beltColor="orange" energy={ENERGY} kind="zu" name="Zu" />
          <BuddyStage beltColor="blue" energy={ENERGY} kind="otto" name="Otto" />
          <TricksterStage />
        </div>
      </DocSection>

      <DocSection title="How characters act">
        <DocRules rules={CHARACTER_RULES} />
      </DocSection>

      <DocSection
        intro="Where a character reacts in the product, and when in the moment its act starts. A revisit draws the act's landing still."
        title="Moments"
      >
        <MomentsTable />
      </DocSection>

      <DocSection
        intro="Each act, its length at 24 frames a second, and where it plays."
        title="Acts"
      >
        <ActsTable />
      </DocSection>

      <DocSection
        intro="Every expression, still, as the server draws it: an act lands in one of these, so it never jumps."
        title="Expressions"
      >
        <ExpressionGrid />
        <Definitions
          items={[...BUDDY_EXPRESSIONS, ...TRICKSTER_EXPRESSIONS].map((expression) => ({
            term: `${expression.label} (\`${expression.name}\`)`,
            text: expression.says,
          }))}
        />
      </DocSection>

      <DocSection
        intro="How each buddy looks at Energy's three faces, as the server draws it."
        title="Lights and Energy"
      >
        <DocRules rules={CHARACTER_LIGHT_RULES} />
        <EnergyGrid />
      </DocSection>

      <DocSection
        intro="The rig is the drawing's own groups: each part turns and stretches around its pivot, so the still drawing is unchanged."
        title="Parts"
      >
        <Definitions
          items={CHARACTER_PARTS.map((part) => ({ term: part.parts, text: part.moves }))}
        />
      </DocSection>

      <DocSection title="Idle">
        <DocRules rules={CHARACTER_IDLE_RULES} />
      </DocSection>

      <DocSection title="Timing">
        <DocRules rules={CHARACTER_TIMING_RULES} />
      </DocSection>
    </>
  );
}
