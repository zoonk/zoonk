import { type MDXComponents } from "mdx/types";
import Image from "next/image";

function MDXImage({ src, alt }: { src?: string; alt?: string }) {
  if (!src) {
    return null;
  }

  return (
    <span className="not-prose relative my-6 block aspect-video w-full overflow-hidden rounded-lg">
      <Image
        src={src}
        alt={alt ?? ""}
        fill
        loading="eager"
        className="object-cover"
        sizes="(max-width: 672px) 100vw, 672px"
      />
    </span>
  );
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...components, img: MDXImage };
}
