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

/* oxlint-disable-next-line eslint/sort-keys */
const PROFILES = {
  x: {
    en: { handle: "@zoonkcom", url: "https://x.com/zoonkcom" },
    icon: XBrandIcon,
    pt: { handle: "@zoonkbr", url: "https://x.com/zoonkbr" },
  },
  linkedin: {
    en: { handle: "@zoonk", url: "https://www.linkedin.com/company/zoonk" },
    icon: LinkedinBrandIcon,
    pt: { handle: "@zoonk", url: "https://www.linkedin.com/company/zoonk" },
  },
  instagram: {
    en: { handle: "@zoonkcom", url: "https://www.instagram.com/zoonkcom" },
    icon: InstagramBrandIcon,
    pt: { handle: "@zoonkbr", url: "https://www.instagram.com/zoonkbr" },
  },
  github: {
    en: { handle: "@zoonk", url: "https://github.com/zoonk" },
    icon: GithubBrandIcon,
    pt: { handle: "@zoonk", url: "https://github.com/zoonk" },
  },
  threads: {
    en: { handle: "@zoonkcom", url: "https://www.threads.net/@zoonkcom" },
    icon: ThreadsBrandIcon,
    pt: { handle: "@zoonkbr", url: "https://www.threads.net/@zoonkbr" },
  },
  reddit: {
    en: { handle: "r/zoonk", url: "https://www.reddit.com/r/zoonk" },
    icon: RedditBrandIcon,
    pt: { handle: "r/ZoonkBrasil", url: "https://www.reddit.com/r/ZoonkBrasil" },
  },
  bluesky: {
    en: { handle: "@zoonk", url: "https://bsky.app/profile/zoonk.bsky.social" },
    icon: BlueskyBrandIcon,
    pt: { handle: "@zoonkbr", url: "https://bsky.app/profile/zoonkbr.bsky.social" },
  },
  youtube: {
    en: { handle: "@zoonkcom", url: "https://www.youtube.com/@zoonkcom" },
    icon: YoutubeBrandIcon,
    pt: { handle: "@zoonkbr", url: "https://www.youtube.com/@zoonkbr" },
  },
  tiktok: {
    en: { handle: "@zoonkcom", url: "https://www.tiktok.com/@zoonkcom" },
    icon: TiktokBrandIcon,
    pt: { handle: "@zoonkbr", url: "https://www.tiktok.com/@zoonkbr" },
  },
  facebook: {
    en: { handle: "@zoonkcom", url: "https://www.facebook.com/zoonkcom" },
    icon: FacebookBrandIcon,
    pt: { handle: "@zoonkbr", url: "https://www.facebook.com/zoonkbr" },
  },
} as const;

// Object.keys returns string[], but we know it matches ProfileName
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const PROFILE_KEYS = Object.keys(PROFILES) as (keyof typeof PROFILES)[];

export function getSocialProfiles(locale: string) {
  return PROFILE_KEYS.map((name) => {
    const profile = PROFILES[name];
    const localeData = locale === "pt" ? profile.pt : profile.en;
    return { icon: profile.icon, name, ...localeData };
  });
}
