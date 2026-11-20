import { getAuthor } from "@/lib/authors";
import { formatPostDate } from "@/lib/posts";
import { FACT_SEPARATOR } from "@zoonk/utils/facts";

/** `date` is the post's day, written "2026-11-12". */
type PostMetaProps = { date: string; authorId: string };

export function PostMeta({ date, authorId }: PostMetaProps) {
  const author = getAuthor(authorId);
  const facts = [formatPostDate({ isoDate: date, year: "always" }), author?.name];

  return (
    <p className="not-prose text-muted-foreground flex flex-wrap items-center gap-x-2 font-mono text-xs">
      <span>{facts.filter(Boolean).join(FACT_SEPARATOR)}</span>

      {author?.social.map((link) => (
        <a
          key={link.label}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={link.label}
          className="hover:text-foreground flex transition-colors"
        >
          <link.icon size={14} />
        </a>
      ))}
    </p>
  );
}
