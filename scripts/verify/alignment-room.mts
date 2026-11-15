import { type AlignmentFinding } from "./alignment-capture.mts";
import {
  type Context,
  EDGE,
  type Group,
  drawn,
  finding,
  notMeasured,
  tenths,
} from "./alignment-geometry.mts";

/**
 * A bar's note sits as far from its line as the buttons sit from the note (craft S2): from the
 * note's line to its first line, and from the note's box to the buttons. A bar with no note shown
 * has nothing to judge.
 */
export function roomLeads(context: Context, read: Group): AlignmentFinding[] {
  const placed = read.parts.filter((part) => part.row === null);
  const note = placed.find((part) => part.part === "note");
  const buttons = placed.find((part) => part.part === "end");

  if (!note) {
    return [];
  }

  // Words that render nothing leave the note's own room, and its line, over the bar.
  if (!drawn(note)) {
    return [
      finding(context, {
        detail: `${note.name ?? note.id} draws nothing and holds ${tenths(note.bounds[3])} over the bar`,
        level: "fail",
        measured: note.bounds[3],
        message: "a bar's note draws nothing and holds its room",
        piece: read.group.piece,
        rule: "room",
      }),
    ];
  }

  if (!note.firstLine || !buttons) {
    return [
      notMeasured(
        context,
        read,
        "room",
        "the note's first line or the buttons weren't found",
        note.name ?? note.id,
      ),
    ];
  }

  const above = note.firstLine[1] - note.bounds[1];
  const below = buttons.bounds[1] - (note.bounds[1] + note.bounds[3]);

  if (Math.abs(above - below) <= EDGE) {
    return [];
  }

  return [
    finding(context, {
      detail: `${note.name ?? note.id} has ${tenths(above)} above it and ${tenths(below)} below it`,
      level: "fail",
      measured: Math.abs(above - below),
      message: "a bar's note isn't as far from its line as from its buttons",
      piece: read.group.piece,
      rule: "room",
    }),
  ];
}
