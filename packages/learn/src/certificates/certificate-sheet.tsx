import { cn } from "@zoonk/ui/lib/utils";
import { type CertificateLinks } from "@zoonk/utils/certificate-links";

/** The screen picture's own size: the print's drawing at two pixels per design unit. */
const SCREEN_WIDTH = 2246;
const SCREEN_HEIGHT = 1588;

/** The document stays white in dark mode, as a PDF viewer shows it: an edge instead of a shadow. */
const SHEET_CLASS = {
  paper:
    "rounded-md shadow-[0_0_0_1px_oklch(0_0_0/7%),0_18px_40px_-18px_oklch(0_0_0/22%)] dark:shadow-[0_0_0_1px_oklch(1_0_0/10%)]",
  thumb:
    "rounded-[4px] shadow-[0_0_0_1px_var(--color-border)] dark:shadow-[0_0_0_1px_oklch(1_0_0/10%)]",
} as const;

/**
 * Every on-screen certificate is the screen picture; print and download take the print one. The box
 * keeps the sheet's shape, so a picture still loading or failing never moves the layout.
 */
export function CertificateSheet({
  alt,
  className,
  images,
  loading,
  variant = "paper",
}: {
  alt: string;
  className?: string;
  images: CertificateLinks["imageUrls"];
  loading?: "eager" | "lazy";
  variant?: keyof typeof SHEET_CLASS;
}) {
  return (
    <span
      className={cn(
        "block aspect-297/210 w-full overflow-hidden bg-white",
        SHEET_CLASS[variant],
        className,
      )}
      data-slot="certificate-sheet"
    >
      {/* oxlint-disable-next-line next/no-img-element -- @zoonk/learn doesn't depend on next/image; the certificate is Main's own rendered PNG. */}
      <img
        alt={alt}
        className="size-full"
        decoding="async"
        height={SCREEN_HEIGHT}
        loading={loading}
        src={images.screen}
        width={SCREEN_WIDTH}
      />
    </span>
  );
}
