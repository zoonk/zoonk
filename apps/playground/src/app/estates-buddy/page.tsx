import { Buddy, type BuddyProps } from "@zoonk/ui/components/buddy";
import { Trickster } from "@zoonk/ui/components/trickster";
import { type BuddyGlasses, type BuddyKind } from "@zoonk/utils/buddy";

// Temporary page for the UX review pack (lane E): the small view of each character, at the sizes
// the app uses and enlarged, with the picture's edge drawn. Not for landing.

const SMALL = { view: "face" } as const satisfies Partial<BuddyProps>;

const KINDS: readonly { kind: BuddyKind; name: string }[] = [
  { kind: "zu", name: "Zu" },
  { kind: "otto", name: "Otto" },
  { kind: "noodle", name: "Noodle" },
  { kind: "beep", name: "Beep" },
];

const BELTS = [
  { belt: "white", stage: "Baby" },
  { belt: "orange", stage: "Young" },
  { belt: "black", stage: "Adult" },
] as const;

const STATES: readonly {
  energy: number;
  glasses: BuddyGlasses;
  label: string;
  studiedToday: boolean;
}[] = [
  { energy: 55, glasses: "round", label: "Awake", studiedToday: true },
  { energy: 100, glasses: "round", label: "Glowing", studiedToday: true },
  { energy: 12, glasses: "round", label: "Napping", studiedToday: false },
  { energy: 55, glasses: "star", label: "Star glasses", studiedToday: true },
  { energy: 55, glasses: "monocle", label: "Monocle", studiedToday: true },
];

const EDGE = "outline-foreground/35 outline outline-1 outline-dashed";

function Cell({ big, sizes }: { big: React.ReactNode; sizes: React.ReactNode }) {
  return (
    <div className="flex items-end gap-3">
      <span className={EDGE}>{big}</span>
      <span className="flex items-end gap-2">{sizes}</span>
    </div>
  );
}

export default function BuddySheet() {
  return (
    <div className="bg-background flex w-[1440px] flex-col gap-8 p-8" data-sheet="all">
      <p className="text-sm">
        The small view of each buddy. The dashed line is the edge of its own picture; beside it, the
        same view at 16, 24 and 32 px.
      </p>

      {KINDS.map(({ kind, name }) => (
        <section className="flex flex-col gap-3" data-sheet={kind} key={kind}>
          <h2 className="text-base font-semibold">{name}</h2>

          <div className="grid grid-cols-[4rem_repeat(5,minmax(0,1fr))] items-end gap-x-4 gap-y-5">
            <span />
            {STATES.map((state) => (
              <span className="text-muted-foreground text-xs" key={state.label}>
                {state.label}
              </span>
            ))}

            {BELTS.flatMap(({ belt, stage }) => [
              <span className="text-muted-foreground self-center text-xs" key={stage}>
                {stage}
              </span>,
              ...STATES.map((state) => {
                const props = {
                  ...SMALL,
                  beltColor: belt,
                  energy: state.energy,
                  glasses: state.glasses,
                  kind,
                  studiedToday: state.studiedToday,
                };

                return (
                  <Cell
                    big={<Buddy {...props} className="size-24" />}
                    key={`${stage}${state.label}`}
                    sizes={
                      <>
                        <Buddy {...props} className="size-4" />
                        <Buddy {...props} className="size-6" />
                        <Buddy {...props} className="size-8" />
                      </>
                    }
                  />
                );
              }),
            ])}
          </div>
        </section>
      ))}

      <section className="flex flex-col gap-3" data-sheet="trickster">
        <h2 className="text-base font-semibold">The Trickster, as a row&apos;s mark</h2>
        <div className="flex items-end gap-10">
          {(["sly", "smug", "defeated"] as const).map((expression) => (
            <Cell
              big={<Trickster className="size-24" expression={expression} view="face" />}
              key={expression}
              sizes={
                <>
                  <Trickster className="size-3.5" expression={expression} view="face" />
                  <Trickster className="size-4" expression={expression} view="face" />
                  <Trickster className="size-5" expression={expression} view="face" />
                </>
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}
