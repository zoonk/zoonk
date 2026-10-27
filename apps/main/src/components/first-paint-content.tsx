import { Suspense } from "react";

/**
 * How long a hard load's first paint waits for the content at most: a slow server's page paints
 * its fallback after this, as it would without the wait.
 */
const MAX_WAIT_MS = 1000;

/**
 * Holds a hard load's first paint until the element `id` is parsed (`rel="expect"`, in Chromium
 * browsers), for content that streams in just after the page's static shell. React keeps a
 * Suspense fallback on screen for 300 ms once it painted, and on a slow phone the shell paints
 * while the parser is still reading the page's inline data, so content parsed a few milliseconds
 * later waited behind its skeleton. Browsers without `rel="expect"` paint the fallback first.
 * After `MAX_WAIT_MS` the link stops blocking but stays: React owns it (hoisted into the head) and
 * removes it itself when the page leaves or hides, which throws for a link already removed.
 */
export function HoldFirstPaint({ id }: { id: string }) {
  const href = `#${id}`;

  return (
    <>
      {/* oxlint-disable-next-line react/no-unknown-property -- `blocking` is HTML's, typed by React but not known to the rule. */}
      <link blocking="render" href={href} rel="expect" />
      <script
        // oxlint-disable-next-line react/no-danger -- A fixed script that must run as the shell is parsed.
        dangerouslySetInnerHTML={{
          __html: `setTimeout(function(){var l=document.querySelector(${JSON.stringify(`link[rel="expect"][href="${href}"]`)});l&&l.removeAttribute("blocking")},${MAX_WAIT_MS})`,
        }}
      />
    </>
  );
}

/**
 * The content, then its end: rendered once the content is, so the end streams after it. A static
 * end would be part of the prerendered shell and release the first paint at once.
 */
async function ContentThenEnd({
  content,
  id,
}: {
  content: () => Promise<React.ReactNode>;
  id: string;
}) {
  return (
    <>
      {await content()}
      <template id={id} />
    </>
  );
}

/**
 * A page's request-time content (`content`, its async Server Component), painted with the page on
 * a hard load instead of after its fallback (`HoldFirstPaint`): the fallback shows only on a server
 * slower than `MAX_WAIT_MS`, in a browser that can't wait, or on a client navigation the prefetch
 * didn't cover. `id` names the end of the content, unique in the document. The content renders in
 * one pass once its data is read: an async component inside it streams later than its end.
 */
export function FirstPaintContent({
  content,
  fallback,
  id,
}: {
  content: () => Promise<React.ReactNode>;
  fallback: React.ReactNode;
  id: string;
}) {
  return (
    <>
      <HoldFirstPaint id={id} />
      <Suspense fallback={fallback}>
        <ContentThenEnd content={content} id={id} />
      </Suspense>
    </>
  );
}
