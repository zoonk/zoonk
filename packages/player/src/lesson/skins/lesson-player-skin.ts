import { type ComponentType, type ReactNode } from "react";

export type LessonProgressProps = { current: number; total: number };

/** The result after a check. */
type LessonScreenFeedback = {
  isCorrect: boolean;
  /** When the idea comes back, a saved mistake, a question returning: quiet lines under it all. */
  notes: ReactNode;
  /** The verdict and the why. Null when the screen shows its own, like an activity. */
  result: ReactNode;
};

export type LessonScreenSlotProps = {
  /** Fun's buddy beside the paper, never inside the text; Focus leaves it out. */
  companion?: ReactNode;
  /** Null while the learner reads or answers. */
  feedback: LessonScreenFeedback | null;
  /** The screen itself. Keep it in the same place in both phases so its state survives the check. */
  question: ReactNode;
};

/**
 * How a mode looks around the same lesson. Skins fill these slots and read nothing but their
 * props: the reducer, the screen model and every screen are shared, so Focus and Fun can never
 * teach, grade or count differently.
 */
export type LessonPlayerSkin = {
  /**
   * The center of the header: the lesson's title and minutes (short lessons open straight on the
   * idea, with no intro screen), or dots that light up.
   */
  HeaderCenter: ComponentType<{ minutes: number; progress: LessonProgressProps; title: string }>;

  /** Under the header: a thin progress bar, or nothing. */
  ProgressBar: ComponentType<LessonProgressProps>;
  /**
   * The screen and, after a check, its result: a banner under the question, or light paper that
   * flips to show the result on its back.
   */
  Screen: ComponentType<LessonScreenSlotProps>;
  /** The page behind the lesson. */
  frameClassName: string;
  /** The main action's look: the app's primary button, or Fun's lime pill. */
  primaryVariant: "default" | "lime";
  /**
   * Hyperdrive (right answers in a row multiplying Brain Power) counts in both modes; Fun shows
   * it live and at the end.
   */
  showsHyperdrive: boolean;
};
