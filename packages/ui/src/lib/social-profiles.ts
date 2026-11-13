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

/* oxlint-disable-next-line eslint/sort-keys */
const PROFILES = {
  x: {
    en: { handle: "@zoonkcom", url: "https://x.com/zoonkcom" },
    icon: XBrandIcon,
    label: "X",
    pt: { handle: "@zoonkbr", url: "https://x.com/zoonkbr" },
  },
  linkedin: {
    en: { handle: "@zoonk", url: "https://www.linkedin.com/company/zoonk" },
    icon: LinkedinBrandIcon,
    label: "LinkedIn",
    pt: { handle: "@zoonk", url: "https://www.linkedin.com/company/zoonk" },
  },
  github: {
    en: { handle: "@zoonk", url: "https://github.com/zoonk" },
    icon: GithubBrandIcon,
    label: "GitHub",
    pt: { handle: "@zoonk", url: "https://github.com/zoonk" },
  },
  instagram: {
    en: { handle: "@zoonkcom", url: "https://www.instagram.com/zoonkcom" },
    icon: InstagramBrandIcon,
    label: "Instagram",
    pt: { handle: "@zoonkbr", url: "https://www.instagram.com/zoonkbr" },
  },
  youtube: {
    en: { handle: "@zoonkcom", url: "https://www.youtube.com/@zoonkcom" },
    icon: YoutubeBrandIcon,
    label: "YouTube",
    pt: { handle: "@zoonkbr", url: "https://www.youtube.com/@zoonkbr" },
  },
  threads: {
    en: { handle: "@zoonkcom", url: "https://www.threads.net/@zoonkcom" },
    icon: ThreadsBrandIcon,
    label: "Threads",
    pt: { handle: "@zoonkbr", url: "https://www.threads.net/@zoonkbr" },
  },
  reddit: {
    en: { handle: "r/zoonk", url: "https://www.reddit.com/r/zoonk" },
    icon: RedditBrandIcon,
    label: "Reddit",
    pt: { handle: "r/ZoonkBrasil", url: "https://www.reddit.com/r/ZoonkBrasil" },
  },
  tiktok: {
    en: { handle: "@zoonkcom", url: "https://www.tiktok.com/@zoonkcom" },
    icon: TiktokBrandIcon,
    label: "TikTok",
    pt: { handle: "@zoonkbr", url: "https://www.tiktok.com/@zoonkbr" },
  },
  facebook: {
    en: { handle: "@zoonkcom", url: "https://www.facebook.com/zoonkcom" },
    icon: FacebookBrandIcon,
    label: "Facebook",
    pt: { handle: "@zoonkbr", url: "https://www.facebook.com/zoonkbr" },
  },
} as const;

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.keys widens the keys to string[].
const PROFILE_KEYS = Object.keys(PROFILES) as (keyof typeof PROFILES)[];

/** The one list of where Zoonk posts, for every app that links to them. */
export function getSocialProfiles(locale: string) {
  return PROFILE_KEYS.map((name) => {
    const profile = PROFILES[name];
    const localeData = locale === "pt" ? profile.pt : profile.en;
    return { icon: profile.icon, label: profile.label, name, ...localeData };
  });
}
