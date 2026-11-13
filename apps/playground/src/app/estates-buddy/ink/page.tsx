import { Buddy, type BuddyExpression } from "@zoonk/ui/components/buddy";
import { Trickster } from "@zoonk/ui/components/trickster";
import { type BuddyGlasses, type BuddyKind } from "@zoonk/utils/buddy";

// Temporary page for the UX review pack (lane E): every variant of the characters on white, with
// room around each drawing, so a script can measure where the ink falls. Not for landing.

const KINDS: readonly BuddyKind[] = ["zu", "otto", "noodle", "beep"];
const BELTS = [
  { belt: "white", stage: "baby" },
  { belt: "orange", stage: "young" },
  { belt: "black", stage: "adult" },
] as const;
const EXPRESSIONS: readonly BuddyExpression[] = [
  "neutral",
  "happy",
  "cheer",
  "proud",
  "wow",
  "think",
  "kind",
  "sleepy",
];
const GLASSES: readonly BuddyGlasses[] = ["round", "star", "aviator", "catEye", "retro", "monocle"];
const ENERGIES = [
  { energy: 12, studiedToday: false },
  { energy: 95, studiedToday: true },
  { energy: 100, studiedToday: true },
] as const;

const CELL = { background: "#fff", height: 300, padding: 60, width: 300 } as const;
const ART = { height: 180, width: 180 } as const;

export default function InkPage() {
  return (
    <div style={{ background: "#fff", display: "flex", flexWrap: "wrap", width: 3600 }}>
      {KINDS.flatMap((kind) =>
        BELTS.flatMap(({ belt, stage }) => [
          ...EXPRESSIONS.map((expression) => (
            <div
              data-cell={`${kind}|${stage}|face:${expression}`}
              key={`${kind}${belt}${expression}`}
              style={CELL}
            >
              <Buddy
                beltColor={belt}
                energy={55}
                expression={expression}
                kind={kind}
                studiedToday
                style={ART}
              />
            </div>
          )),
          ...GLASSES.map((glasses) => (
            <div
              data-cell={`${kind}|${stage}|glasses:${glasses}`}
              key={`${kind}${belt}${glasses}`}
              style={CELL}
            >
              <Buddy
                beltColor={belt}
                energy={55}
                glasses={glasses}
                kind={kind}
                studiedToday
                style={ART}
              />
            </div>
          )),
          ...ENERGIES.map(({ energy, studiedToday }) => (
            <div
              data-cell={`${kind}|${stage}|energy:${energy}`}
              key={`${kind}${belt}${energy}`}
              style={CELL}
            >
              <Buddy
                beltColor={belt}
                energy={energy}
                kind={kind}
                studiedToday={studiedToday}
                style={ART}
              />
            </div>
          )),
        ]),
      )}
      {KINDS.flatMap((kind) => [
        ...EXPRESSIONS.map((expression) => (
          <div
            data-cell={`${kind}|face|face:${expression}`}
            key={`f${kind}${expression}`}
            style={CELL}
          >
            <Buddy
              beltColor="black"
              energy={55}
              expression={expression}
              kind={kind}
              studiedToday
              style={ART}
              view="face"
            />
          </div>
        )),
        ...GLASSES.map((glasses) => (
          <div
            data-cell={`${kind}|face|glasses:${glasses}`}
            key={`f${kind}${glasses}`}
            style={CELL}
          >
            <Buddy
              beltColor="black"
              energy={55}
              glasses={glasses}
              kind={kind}
              studiedToday
              style={ART}
              view="face"
            />
          </div>
        )),
        ...ENERGIES.map(({ energy, studiedToday }) => (
          <div data-cell={`${kind}|face|energy:${energy}`} key={`f${kind}${energy}`} style={CELL}>
            <Buddy
              beltColor="white"
              energy={energy}
              kind={kind}
              studiedToday={studiedToday}
              style={ART}
              view="face"
            />
          </div>
        )),
      ])}
      {(["sly", "smug", "defeated"] as const).map((expression) => (
        <div data-cell={`trickster|face|face:${expression}`} key={`f${expression}`} style={CELL}>
          <Trickster expression={expression} style={ART} view="face" />
        </div>
      ))}
      {(["sly", "smug", "defeated"] as const).flatMap((expression) =>
        (["sly", "hero"] as const).map((pose) => (
          <div
            data-cell={`trickster|${pose}|face:${expression}`}
            key={`${expression}${pose}`}
            style={CELL}
          >
            <Trickster expression={expression} pose={pose} style={ART} />
          </div>
        )),
      )}
    </div>
  );
}
