"use client";

import { captureException } from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        {/* The App Router doesn't expose error status codes, so 0 renders a generic message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
