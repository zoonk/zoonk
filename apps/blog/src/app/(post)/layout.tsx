export default function PostLayout({ children }: LayoutProps<"/">) {
  return (
    <article className="prose prose-neutral dark:prose-invert prose-headings:font-semibold max-w-none">
      {children}
    </article>
  );
}
