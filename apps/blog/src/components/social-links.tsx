import {
  IconBrandBluesky,
  IconBrandFacebook,
  IconBrandGithub,
  IconBrandInstagram,
  IconBrandLinkedin,
  IconBrandReddit,
  IconBrandThreads,
  IconBrandTiktok,
  IconBrandX,
  IconBrandYoutube,
} from "@tabler/icons-react";

const SOCIAL_LINKS = [
  { icon: IconBrandX, label: "X", url: "https://x.com/zoonkcom" },
  {
    icon: IconBrandLinkedin,
    label: "LinkedIn",
    url: "https://www.linkedin.com/company/zoonk",
  },
  {
    icon: IconBrandGithub,
    label: "GitHub",
    url: "https://github.com/zoonk",
  },
  {
    icon: IconBrandInstagram,
    label: "Instagram",
    url: "https://www.instagram.com/zoonkcom",
  },
  {
    icon: IconBrandYoutube,
    label: "YouTube",
    url: "https://www.youtube.com/@zoonkcom",
  },
  {
    icon: IconBrandBluesky,
    label: "Bluesky",
    url: "https://bsky.app/profile/zoonk.bsky.social",
  },
  {
    icon: IconBrandThreads,
    label: "Threads",
    url: "https://www.threads.net/@zoonkcom",
  },
  {
    icon: IconBrandReddit,
    label: "Reddit",
    url: "https://www.reddit.com/r/zoonk",
  },
  {
    icon: IconBrandTiktok,
    label: "TikTok",
    url: "https://www.tiktok.com/@zoonkcom",
  },
  {
    icon: IconBrandFacebook,
    label: "Facebook",
    url: "https://www.facebook.com/zoonkcom",
  },
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
          <link.icon size={16} stroke={1.5} />
        </a>
      ))}
    </nav>
  );
}
