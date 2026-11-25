export type WritingResiduals = {
  over: readonly number[];
  overFloor: number;
  under: readonly number[];
  underFloor: number;
};

type Calibration<Kind extends string> = WritingResiduals & {
  grader: { model: string; promptRevision: Readonly<Record<Kind, string>> };
  keyWriter: { model: string; promptRevision: string };
  points: boolean;
};

export const writingCalibration: Readonly<{
  keyed: Calibration<"points" | "oab"> | null;
  enem: Calibration<"enem"> | null;
}> = { enem: null, keyed: null };
