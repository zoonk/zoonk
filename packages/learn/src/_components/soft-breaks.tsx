import { Fragment } from "react";

/** A link that has to wrap breaks after a slash or a query's separators, never inside its host or a word. */
export function SoftBreaks({ children }: { children: string }) {
  const parts = children.split(/(?<=[/?&=])/u);

  return parts.map((part, index) => (
    // oxlint-disable-next-line react/no-array-index-key -- The parts of one fixed string never reorder.
    <Fragment key={index}>
      {index > 0 && <wbr />}
      {part}
    </Fragment>
  ));
}
