import { ThemeImage } from "./theme-image";

export const COVER_SIZES = "(max-width: 672px) 100vw, 672px";

export function CoverFrame({ children }: { children: React.ReactNode }) {
  return (
    <span className="not-prose relative my-6 block aspect-video w-full overflow-hidden rounded-lg">
      {children}
    </span>
  );
}

export function Cover({ alt, darkSrc, src }: { alt: string; darkSrc: string; src: string }) {
  return (
    <CoverFrame>
      <ThemeImage
        alt={alt}
        className="object-cover"
        darkSrc={darkSrc}
        fetchPriority="high"
        fill
        sizes={COVER_SIZES}
        src={src}
      />
    </CoverFrame>
  );
}
