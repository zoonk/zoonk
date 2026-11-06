// Every buddy and Trickster pose the films use, for scripts/export-art.mjs to save as SVG files.
import { BuddyFigure } from "@repo/packages/ui/src/components/buddy.tsx";
import { TricksterFigure } from "@repo/packages/ui/src/components/trickster.tsx";

const BUDDIES = [
  ["zu-baby-happy", { beltColor: "white", expression: "happy" }],
  ["zu-baby-cheer", { beltColor: "yellow", expression: "cheer" }],
  ["zu-baby-think", { beltColor: "yellow", expression: "think" }],
  ["zu-baby-kind", { beltColor: "yellow", expression: "kind" }],
  ["zu-baby-wow", { beltColor: "yellow", expression: "wow" }],
  ["zu-baby-face", { beltColor: "yellow", expression: "happy", crop: "face" }],
  ["zu-young-happy", { beltColor: "green", expression: "happy" }],
  ["zu-young-cheer", { beltColor: "blue", expression: "cheer" }],
  ["zu-adult-proud", { beltColor: "black", expression: "proud" }],
  ["zu-adult-cheer", { beltColor: "red", expression: "cheer" }],
] as const;

const TRICKSTERS = ["sly", "smug", "defeated"] as const;

function Art() {
  return (
    <div>
      {BUDDIES.map(([name, props]) => (
        <div data-art={name} key={name}>
          <BuddyFigure energy={0.8} kind="zu" studiedToday {...props} />
        </div>
      ))}
      {TRICKSTERS.map((expression) => (
        <div data-art={`trickster-${expression}`} key={expression}>
          <TricksterFigure expression={expression} />
        </div>
      ))}
    </div>
  );
}

export const views = { art: Art };
