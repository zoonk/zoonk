export default function PostLayout({ children }: LayoutProps<"/">) {
  return <article className="prose dark:prose-invert max-w-none">{children}</article>;
}
