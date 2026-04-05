import { getAuthor } from "@/lib/authors";

type PostMetaProps = {
  date: string;
  authorId: string;
};

/**
 * Displays post metadata below the title: date and author
 * with icon links to their social profiles.
 * Used inside each MDX post file.
 */
export function PostMeta({ date, authorId }: PostMetaProps) {
  const author = getAuthor(authorId);

  return (
    <p className="not-prose text-muted-foreground flex flex-wrap items-center gap-x-2 font-mono text-xs">
      <span>{date}</span>

      {author && (
        <>
          <span>|</span>

          <span className="flex items-center gap-x-2">
            <span>{author.name}</span>

            {author.social.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.label}
                className="hover:text-foreground transition-colors"
              >
                <link.icon size={14} stroke={1.5} />
              </a>
            ))}
          </span>
        </>
      )}
    </p>
  );
}
