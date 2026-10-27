import {
  BUDDY_EXPRESSIONS,
  CHARACTER_IDLE_RULES,
  CHARACTER_PARTS,
  CHARACTER_RULES,
  CHARACTER_TIMING_RULES,
  type CharacterExpression,
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

function ExpressionCell({
  children,
  expression,
}: {
  children: React.ReactNode;
  expression: CharacterExpression<string>;
}) {
  return (
    <figure className="flex flex-col items-center gap-1 text-center">
      {children}
      <figcaption className="text-xs font-medium">{expression.label}</figcaption>
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
              <ExpressionCell expression={expression} key={expression.name}>
                <Buddy
                  beltColor="orange"
                  className="size-20"
                  energy={ENERGY}
                  expression={expression.name}
                  kind={kind}
                  studiedToday
                />
              </ExpressionCell>
            ))}
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs font-medium">The Trickster</p>
        <div className={GRID}>
          {TRICKSTER_EXPRESSIONS.map((expression) => (
            <ExpressionCell expression={expression} key={expression.name}>
              <Trickster className="size-20" expression={expression.name} />
            </ExpressionCell>
          ))}
        </div>
      </div>
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
        A lab for how the buddy and the Trickster act: their parts move (eyes first, then the mouth,
        the head and the limbs, loose parts last), never the whole drawing at once. The rig is part
        of the real components; nothing here plays in the product yet, where characters hold still
        until the owner approves an act for a moment.
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
        intro="Each act, its length at 24 frames a second, and where it would play once approved."
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
