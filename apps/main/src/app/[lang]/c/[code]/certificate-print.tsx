"use client";

import { useEffect } from "react";

const PRINT_SLOT = "certificate-print";

/**
 * A direct child of `body`, so the print stylesheet can hide everything else and print only the
 * certificate, light and full page whatever the theme. It leaves with the page, including when the
 * router keeps the page hidden for Back, so printing another page prints that page.
 */
export function CertificatePrint({ src }: { src: string }) {
  useEffect(() => {
    const image = document.createElement("img");
    image.alt = "";
    image.dataset.slot = PRINT_SLOT;
    image.src = src;
    document.body.append(image);

    return () => image.remove();
  }, [src]);

  return null;
}
