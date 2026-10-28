import { notFound } from "next/navigation";
import { Suspense } from "react";

function NotFoundStatus(): never {
  notFound();
}

/**
 * A `notFound()` anywhere else leaves the message to the browser's scripts, so a static page would
 * ship an empty document. Here the message is drawn on the server, then `notFound()` throws inside
 * an empty boundary.
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
