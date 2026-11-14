import {
  FacebookBrandIcon,
  GithubBrandIcon,
  InstagramBrandIcon,
  LinkedinBrandIcon,
  RedditBrandIcon,
  ThreadsBrandIcon,
  TiktokBrandIcon,
  XBrandIcon,
  YoutubeBrandIcon,
} from "../components/brand-icons";

/**
 * Where Zoonk posts, in the order every "Follow us" list shows them. The app's Help page and the
 * blog read this one list, so a profile added or dropped changes both.
 */
const PROFILES = [
  {
    en: { url: "https://x.com/zoonkcom" },
    icon: XBrandIcon,
    label: "X",
    name: "x",
    pt: { url: "https://x.com/zoonkbr" },
  },
  {
    en: { url: "https://www.linkedin.com/company/zoonk" },
    icon: LinkedinBrandIcon,
    label: "LinkedIn",
    name: "linkedin",
    pt: { url: "https://www.linkedin.com/company/zoonk" },
  },
  {
    en: { url: "https://github.com/zoonk" },
    icon: GithubBrandIcon,
    label: "GitHub",
    name: "github",
    pt: { url: "https://github.com/zoonk" },
  },
  {
    en: { url: "https://www.instagram.com/zoonkcom" },
    icon: InstagramBrandIcon,
    label: "Instagram",
    name: "instagram",
    pt: { url: "https://www.instagram.com/zoonkbr" },
  },
  {
    en: { url: "https://www.youtube.com/@zoonkcom" },
    icon: YoutubeBrandIcon,
    label: "YouTube",
    name: "youtube",
    pt: { url: "https://www.youtube.com/@zoonkbr" },
  },
  {
    en: { url: "https://www.threads.net/@zoonkcom" },
    icon: ThreadsBrandIcon,
    label: "Threads",
    name: "threads",
    pt: { url: "https://www.threads.net/@zoonkbr" },
  },
  {
    en: { url: "https://www.reddit.com/r/zoonk" },
    icon: RedditBrandIcon,
    label: "Reddit",
    name: "reddit",
    pt: { url: "https://www.reddit.com/r/ZoonkBrasil" },
  },
  {
    en: { url: "https://www.tiktok.com/@zoonkcom" },
    icon: TiktokBrandIcon,
    label: "TikTok",
    name: "tiktok",
    pt: { url: "https://www.tiktok.com/@zoonkbr" },
  },
  {
    en: { url: "https://www.facebook.com/zoonkcom" },
    icon: FacebookBrandIcon,
    label: "Facebook",
    name: "facebook",
    pt: { url: "https://www.facebook.com/zoonkbr" },
  },
] as const;

export function getSocialProfiles(locale: string) {
  return PROFILES.map(({ en, icon, label, name, pt }) => ({
    icon,
    label,
    name,
    ...(locale === "pt" ? pt : en),
  }));
}
