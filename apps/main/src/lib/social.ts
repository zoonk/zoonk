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

const PROFILES = {
  x: {
    en: { handle: "@zoonkcom", url: "https://x.com/zoonkcom" },
    icon: IconBrandX,
    pt: { handle: "@zoonkbr", url: "https://x.com/zoonkbr" },
  },
  linkedin: {
    en: { handle: "@zoonk", url: "https://www.linkedin.com/company/zoonk" },
    icon: IconBrandLinkedin,
    pt: { handle: "@zoonk", url: "https://www.linkedin.com/company/zoonk" },
  },
  instagram: {
    en: { handle: "@zoonkcom", url: "https://www.instagram.com/zoonkcom" },
    icon: IconBrandInstagram,
    pt: { handle: "@zoonkbr", url: "https://www.instagram.com/zoonkbr" },
  },
  github: {
    en: { handle: "@zoonk", url: "https://github.com/zoonk" },
    icon: IconBrandGithub,
    pt: { handle: "@zoonk", url: "https://github.com/zoonk" },
  },
  threads: {
    en: { handle: "@zoonkcom", url: "https://www.threads.net/@zoonkcom" },
    icon: IconBrandThreads,
    pt: { handle: "@zoonkbr", url: "https://www.threads.net/@zoonkbr" },
  },
  reddit: {
    en: { handle: "r/zoonk", url: "https://www.reddit.com/r/zoonk" },
    icon: IconBrandReddit,
    pt: {
      handle: "r/ZoonkBrasil",
      url: "https://www.reddit.com/r/ZoonkBrasil",
    },
  },
  bluesky: {
    en: { handle: "@zoonk", url: "https://bsky.app/profile/zoonk.bsky.social" },
    icon: IconBrandBluesky,
    pt: {
      handle: "@zoonkbr",
      url: "https://bsky.app/profile/zoonkbr.bsky.social",
    },
  },
  youtube: {
    en: { handle: "@zoonkcom", url: "https://www.youtube.com/@zoonkcom" },
    icon: IconBrandYoutube,
    pt: { handle: "@zoonkbr", url: "https://www.youtube.com/@zoonkbr" },
  },
  tiktok: {
    en: { handle: "@zoonkcom", url: "https://www.tiktok.com/@zoonkcom" },
    icon: IconBrandTiktok,
    pt: { handle: "@zoonkbr", url: "https://www.tiktok.com/@zoonkbr" },
  },
  facebook: {
    en: { handle: "@zoonkcom", url: "https://www.facebook.com/zoonkcom" },
    icon: IconBrandFacebook,
    pt: { handle: "@zoonkbr", url: "https://www.facebook.com/zoonkbr" },
  },
} as const;

type ProfileName = keyof typeof PROFILES;

// Object.keys returns string[], but we know it matches ProfileName
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const PROFILE_KEYS = Object.keys(PROFILES) as ProfileName[];

export function getSocialProfiles(locale: string) {
  return PROFILE_KEYS.map((name) => {
    const profile = PROFILES[name];
    const localeData = locale === "pt" ? profile.pt : profile.en;
    return { icon: profile.icon, name, ...localeData };
  });
}
