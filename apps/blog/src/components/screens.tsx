import { ThemeImage } from "./theme-image";

export function Screens({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-label="Screenshots"
      className="not-prose bg-ground -mx-6 my-10 flex snap-x snap-mandatory scroll-px-6 justify-center-safe gap-4 overflow-x-auto p-6 *:w-[min(72%,15.5rem)] md:rounded-2xl lg:-mx-28 lg:gap-5 lg:p-8 lg:*:w-76 lg:has-[>:nth-child(3)]:*:w-62"
      role="group"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- A row that scrolls must take keyboard focus to scroll with the arrow keys.
      tabIndex={0}
    >
      {children}
    </div>
  );
}

/** Takes screenshots of the 390 × 844 phone screen that `pnpm pr:capture` shoots. */
export function Screen({
  alt,
  children,
  darkSrc,
  src,
}: {
  alt: string;
  children?: React.ReactNode;
  darkSrc: string;
  src: string;
}) {
  return (
    <figure className="shrink-0 snap-start">
      <div className="bg-card ring-border relative aspect-390/844 overflow-hidden rounded-4xl ring-1">
        <ThemeImage
          alt={alt}
          className="object-cover"
          darkSrc={darkSrc}
          fill
          sizes="19rem"
          src={src}
        />
      </div>

      {children && (
        <figcaption className="text-muted-foreground mt-3 text-center text-sm text-pretty">
          {children}
        </figcaption>
      )}
    </figure>
  );
}
