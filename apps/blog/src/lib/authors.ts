import {
  type BrandIconComponent,
  LinkedinBrandIcon,
  XBrandIcon,
} from "@zoonk/ui/components/brand-icons";

type AuthorSocial = { icon: BrandIconComponent; label: string; url: string };

type Author = { name: string; social: AuthorSocial[] };

/**
 * Author registry for blog posts.
 * Each author has a name and a list of social profiles
 * that are displayed as icons alongside their posts.
 */
const AUTHORS: Record<string, Author> = {
  will: {
    name: "Will Ceolin",
    social: [
      { icon: XBrandIcon, label: "X", url: "https://x.com/ceolinwill" },
      { icon: LinkedinBrandIcon, label: "LinkedIn", url: "https://linkedin.com/in/ceolinwill" },
    ],
  },
};

/** Look up an author by their ID. */
export function getAuthor(authorId: string): Author | null {
  return AUTHORS[authorId] ?? null;
}
