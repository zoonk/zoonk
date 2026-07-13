import {
  BlueskyBrandIcon,
  FacebookBrandIcon,
  GithubBrandIcon,
  InstagramBrandIcon,
  LinkedinBrandIcon,
  RedditBrandIcon,
  ThreadsBrandIcon,
  TiktokBrandIcon,
  XBrandIcon,
  YoutubeBrandIcon,
} from "@zoonk/ui/components/brand-icons";

const SOCIAL_LINKS = [
  { icon: XBrandIcon, label: "X", url: "https://x.com/zoonkcom" },
  { icon: LinkedinBrandIcon, label: "LinkedIn", url: "https://www.linkedin.com/company/zoonk" },
  { icon: GithubBrandIcon, label: "GitHub", url: "https://github.com/zoonk" },
  { icon: InstagramBrandIcon, label: "Instagram", url: "https://www.instagram.com/zoonkcom" },
  { icon: YoutubeBrandIcon, label: "YouTube", url: "https://www.youtube.com/@zoonkcom" },
  { icon: BlueskyBrandIcon, label: "Bluesky", url: "https://bsky.app/profile/zoonk.bsky.social" },
  { icon: ThreadsBrandIcon, label: "Threads", url: "https://www.threads.net/@zoonkcom" },
  { icon: RedditBrandIcon, label: "Reddit", url: "https://www.reddit.com/r/zoonk" },
  { icon: TiktokBrandIcon, label: "TikTok", url: "https://www.tiktok.com/@zoonkcom" },
  { icon: FacebookBrandIcon, label: "Facebook", url: "https://www.facebook.com/zoonkcom" },
];

/** Social media icon links displayed in the footer on all pages. */
export function SocialLinks() {
  return (
    <nav className="flex flex-wrap gap-3" aria-label="Social media">
      {SOCIAL_LINKS.map((link) => (
        <a
          key={link.label}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={link.label}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <link.icon size={16} />
        </a>
      ))}
    </nav>
  );
}
