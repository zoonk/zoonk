/**
 * What the eval script measured for one revision of the pipeline that reads, keys and grades
 * written answers. Residuals are per answer, as shares of the answer's maximum, sorted ascending:
 * `over` is how far our mark sat above the board's, `under` how far below.
 */
export type WritingCalibration = {
  grader: { model: string; promptVersion: string };
  points: boolean;
  residuals: { over: readonly number[]; under: readonly number[] };
  verdicts: { above: boolean; below: boolean };
};

export const writingCalibration: WritingCalibration | null = null;
