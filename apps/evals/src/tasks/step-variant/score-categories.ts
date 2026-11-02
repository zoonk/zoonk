import { defineScoreCategories } from "@/lib/score-categories";

export const STEP_VARIANT_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `Audit whether the version is what was asked. "field": the same idea with its example set in the field named in KEY, the way people there meet it at work. "tool": the same idea shown the way the learner does it in the tool named in KEY, with real function names, syntax, menus and output that work in every choice the key lists ("Google Sheets or Excel"); a check asks what the tool does or shows. "tool" with KEY "no-install": every step that would install, open or run something on the learner's own device becomes an example they read (what would be typed and exactly what it shows or prints) or a small simulation to follow, never asking them to install, download, open or run anything, and never saying they miss out. Score at most 6 when a field version's example isn't from that field, a tool version has wrong syntax or output, or a no-install version still asks the learner to do something on their device; at most 8 when the field or the tool barely shows.`,
    id: "versionFit",
    label: "Actually the version asked for",
    weight: 40,
  },
  {
    expectations: `Audit faithfulness and accuracy. The same idea as the original screen, every fact and number correct, nothing that contradicts the original, and no ideas that belong to other lessons. Score at most 6 for any error; at most 8 when it drifts to a different idea.`,
    id: "faithful",
    label: "Faithful and correct",
    weight: 35,
  },
  {
    expectations: `Audit the writing. One short screen (about the original's length, never a wall of text), short sentences, "you", the requested language variant, no introduction such as "Here is a version for nurses", no filler and no promises of results. Score at most 7 for an introduction, filler or a much longer screen; at most 6 for the wrong language.`,
    id: "writing",
    label: "Short, plain writing",
    weight: 25,
  },
]);
