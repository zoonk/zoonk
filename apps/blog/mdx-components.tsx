import { COVER_SIZES, CoverFrame } from "@/components/cover";
import { type MDXComponents } from "mdx/types";
import Image from "next/image";

function MDXImage({ src, alt }: { src?: string; alt?: string }) {
  if (!src) {
    return null;
  }

  return (
    <CoverFrame>
      <Image
        src={src}
        alt={alt ?? ""}
        fill
        loading="eager"
        className="object-cover"
        sizes={COVER_SIZES}
      />
    </CoverFrame>
  );
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...components, img: MDXImage };
}
