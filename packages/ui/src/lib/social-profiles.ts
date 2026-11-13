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
/* oxlint-disable-next-line eslint/sort-keys */
const PROFILES = {
  x: {
    en: { url: "https://x.com/zoonkcom" },
    icon: XBrandIcon,
    label: "X",
    pt: { url: "https://x.com/zoonkbr" },
  },
  linkedin: {
    en: { url: "https://www.linkedin.com/company/zoonk" },
    icon: LinkedinBrandIcon,
    label: "LinkedIn",
    pt: { url: "https://www.linkedin.com/company/zoonk" },
  },
  github: {
    en: { url: "https://github.com/zoonk" },
    icon: GithubBrandIcon,
    label: "GitHub",
    pt: { url: "https://github.com/zoonk" },
  },
  instagram: {
    en: { url: "https://www.instagram.com/zoonkcom" },
    icon: InstagramBrandIcon,
    label: "Instagram",
    pt: { url: "https://www.instagram.com/zoonkbr" },
  },
  youtube: {
    en: { url: "https://www.youtube.com/@zoonkcom" },
    icon: YoutubeBrandIcon,
    label: "YouTube",
    pt: { url: "https://www.youtube.com/@zoonkbr" },
  },
  threads: {
    en: { url: "https://www.threads.net/@zoonkcom" },
    icon: ThreadsBrandIcon,
    label: "Threads",
    pt: { url: "https://www.threads.net/@zoonkbr" },
  },
  reddit: {
    en: { url: "https://www.reddit.com/r/zoonk" },
    icon: RedditBrandIcon,
    label: "Reddit",
    pt: { url: "https://www.reddit.com/r/ZoonkBrasil" },
  },
  tiktok: {
    en: { url: "https://www.tiktok.com/@zoonkcom" },
    icon: TiktokBrandIcon,
    label: "TikTok",
    pt: { url: "https://www.tiktok.com/@zoonkbr" },
  },
  facebook: {
    en: { url: "https://www.facebook.com/zoonkcom" },
    icon: FacebookBrandIcon,
    label: "Facebook",
    pt: { url: "https://www.facebook.com/zoonkbr" },
  },
} as const;

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.keys widens the keys to string[].
const PROFILE_KEYS = Object.keys(PROFILES) as (keyof typeof PROFILES)[];

export function getSocialProfiles(locale: string) {
  return PROFILE_KEYS.map((name) => {
    const profile = PROFILES[name];
    const localeData = locale === "pt" ? profile.pt : profile.en;
    return { icon: profile.icon, label: profile.label, name, ...localeData };
  });
}
