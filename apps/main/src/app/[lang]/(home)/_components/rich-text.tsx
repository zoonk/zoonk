import { type ReactNode } from "react";

/** Bold words inside a translated sentence (`<b>...</b>` in the message). */
export function renderBold(chunks: ReactNode) {
  return <b>{chunks}</b>;
}
