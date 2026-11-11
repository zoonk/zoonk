"use client";

import { type ComponentType, type ReactNode, createContext, use } from "react";
import { type DayStep, type StudyDay } from "./session-types";

/** `open` resolves to false when it couldn't open the step, and true once it did or the learner left. */
export type DayStepOpenerProps = {
  children: (open: (step: DayStep) => Promise<boolean>) => ReactNode;
  day: StudyDay;
  goalId: string;
};

const DayStepOpenerContext = createContext<ComponentType<DayStepOpenerProps> | null>(null);

/** Pass a component defined at module level: it opens a day's step the way Today's rows do. */
export function DayStepOpenerProvider({
  children,
  opener,
}: {
  children: ReactNode;
  opener: ComponentType<DayStepOpenerProps>;
}) {
  return <DayStepOpenerContext value={opener}>{children}</DayStepOpenerContext>;
}

export function DayStepOpener(props: DayStepOpenerProps) {
  const Opener = use(DayStepOpenerContext);

  if (!Opener) {
    throw new Error("DayStepOpener must be used within a DayStepOpenerProvider");
  }

  // oxlint-disable-next-line react/static-components -- The host supplies a stable module-level opener through context; nothing is created here.
  return <Opener {...props} />;
}
