import { Fragment } from "react";

/** A link or a code that has to wrap breaks after its own separators, never inside a word. */
export function SoftBreaks({ children }: { children: string }) {
  const parts = children.split(/(?<=[/.?&=_-])/u);

  return parts.map((part, index) => (
    // oxlint-disable-next-line react/no-array-index-key -- The parts of one fixed string never reorder.
    <Fragment key={index}>
      {index > 0 && <wbr />}
      {part}
    </Fragment>
  ));
}
