import { type MDXComponents } from "mdx/types";
import Image from "next/image";

/**
 * MDX image override using next/image for optimization.
 * Uses `fill` mode inside a responsive container so images
 * scale to the content width while maintaining their aspect ratio.
 * The `not-prose` class prevents the typography plugin from
 * adding its own spacing/margins that interfere with rounded corners.
 */
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
  return {
    ...components,
    img: MDXImage,
  };
}
