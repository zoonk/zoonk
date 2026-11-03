import { cn } from "@zoonk/ui/lib/utils";
import Image, { type ImageProps } from "next/image";

/** Both stay lazy, so the browser loads only the one its theme shows. */
export function ThemeImage({
  className,
  darkSrc,
  src,
  ...props
}: Omit<ImageProps, "loading" | "preload" | "src"> & { darkSrc: string; src: string }) {
  return (
    <>
      <Image {...props} className={cn(className, "dark:hidden")} src={src} />
      <Image {...props} className={cn(className, "hidden dark:block")} src={darkSrc} />
    </>
  );
}
