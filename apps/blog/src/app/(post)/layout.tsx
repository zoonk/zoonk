export default function PostLayout({ children }: LayoutProps<"/">) {
  return (
    <article className="prose prose-neutral dark:prose-invert prose-headings:font-semibold prose-p:leading-[1.6] prose-li:leading-[1.6] prose-li:marker:text-muted-foreground prose-ul:ps-5 prose-ol:ps-5 prose-li:ps-2 max-w-none">
      {children}
    </article>
  );
}
