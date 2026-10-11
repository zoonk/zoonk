import { type LessonVisual } from "@zoonk/ai/tasks/v2/visuals/schema";
import { type ItemSetKind } from "@zoonk/db";
import { type ListeningSetView } from "../listening/listening-set-view";

/**
 * The stimulus a set's question shows with it, never an answer: a text's or a case's words, a
 * chart's data and words, or a recording (`listening`: its file and how many times it plays, and
 * its transcript only once its questions are answered). `position` and `count` place the question
 * in its set.
 */
export type ItemSetView = {
  count: number;
  id: string;
  kind: ItemSetKind;
  listening: ListeningSetView | null;
  position: number;
  source: string | null;
  text: string | null;
  title: string | null;
  visual: LessonVisual | null;
};
