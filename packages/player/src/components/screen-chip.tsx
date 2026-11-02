import { SCREEN_CHIP_CLASS } from "../lesson/_components/lesson-step-text";

export function ScreenChip({ children }: { children: React.ReactNode }) {
  return <span className={SCREEN_CHIP_CLASS}>{children}</span>;
}
