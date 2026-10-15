import { notFound } from "next/navigation";
import { Suspense } from "react";

/** Answers the page with a 404, from inside a boundary so the message around it stays. */
function NotFoundStatus(): never {
  notFound();
}

/**
 * A page's answer when what it shows isn't there: `children` is its route's not-found message (the
 * one its `not-found.tsx` shows), drawn on the server, then `notFound()` thrown inside an empty
 * boundary. A `notFound()` anywhere else leaves the message to the browser's scripts: a static page
 * ships an empty document, and a page drawn per request keeps its loading placeholder until they
 * run. Drawn here, a static page is written whole with a 404, and a page drawn per request streams
 * the message in place of its placeholder (its 200 is already sent, so Next.js marks it noindex).
 * In the browser, the route's not-found boundary then shows the same message.
 */
export function NotFoundPage({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}

      <Suspense fallback={null}>
        <NotFoundStatus />
      </Suspense>
    </>
  );
}
