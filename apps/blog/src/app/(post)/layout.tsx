import { BackLink } from "@zoonk/ui/components/page-top";
import Link from "next/link";

const BLOG_NAME = "Zoonk blog";

export default function PostLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <nav aria-label="Blog" className="mb-6">
        <BackLink aria-label={`Back to ${BLOG_NAME}`} render={<Link href="/" />}>
          {BLOG_NAME}
        </BackLink>
      </nav>

      <article className="prose prose-neutral dark:prose-invert prose-h1:text-balance prose-h2:font-semibold prose-h3:font-semibold prose-h4:font-semibold prose-p:leading-[1.6] prose-p:text-pretty prose-li:leading-[1.6] prose-li:marker:text-muted-foreground prose-ul:ps-5 prose-ol:ps-5 prose-li:ps-2 max-w-none">
        {children}
      </article>
    </>
  );
}
