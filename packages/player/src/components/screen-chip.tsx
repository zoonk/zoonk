import { SCREEN_CHIP_CLASS } from "../lesson/_components/lesson-step-text";

/**
 * What a language screen asks ("Translate", "What do you hear?"), in the colorless chip every
 * screen wears over its question.
 */
export function ScreenChip({ children }: { children: React.ReactNode }) {
  return <span className={SCREEN_CHIP_CLASS}>{children}</span>;
}
