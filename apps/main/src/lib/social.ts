import {
  IconBrandBluesky,
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandLinkedin,
  IconBrandReddit,
  IconBrandThreads,
  IconBrandTiktok,
  IconBrandX,
  IconBrandYoutube,
} from "@tabler/icons-react";
import { routing } from "@/i18n/routing";

const PROFILES = {
  bluesky: {
    en: { handle: "@zoonk", url: "https://bsky.app/profile/zoonk.bsky.social" },
    icon: IconBrandBluesky,
    pt: {
      handle: "@zoonkbr",
      url: "https://bsky.app/profile/zoonkbr.bsky.social",
    },
  },
  facebook: {
    en: { handle: "@zoonkcom", url: "https://www.facebook.com/zoonkcom" },
    icon: IconBrandFacebook,
    pt: { handle: "@zoonkbr", url: "https://www.facebook.com/zoonkbr" },
  },
  instagram: {
    en: { handle: "@zoonkcom", url: "https://www.instagram.com/zoonkcom" },
    icon: IconBrandInstagram,
    pt: { handle: "@zoonkbr", url: "https://www.instagram.com/zoonkbr" },
  },
  linkedin: {
    en: { handle: "@zoonk", url: "https://www.linkedin.com/company/zoonk" },
    icon: IconBrandLinkedin,
    pt: { handle: "@zoonk", url: "https://www.linkedin.com/company/zoonk" },
  },
  reddit: {
    en: { handle: "r/zoonk", url: "https://www.reddit.com/r/zoonk" },
    icon: IconBrandReddit,
    pt: {
      handle: "r/ZoonkBrasil",
      url: "https://www.reddit.com/r/ZoonkBrasil",
    },
  },
  threads: {
    en: { handle: "@zoonkcom", url: "https://www.threads.net/@zoonkcom" },
    icon: IconBrandThreads,
    pt: { handle: "@zoonkbr", url: "https://www.threads.net/@zoonkbr" },
  },
  tiktok: {
    en: { handle: "@zoonkcom", url: "https://www.tiktok.com/@zoonkcom" },
    icon: IconBrandTiktok,
    pt: { handle: "@zoonkbr", url: "https://www.tiktok.com/@zoonkbr" },
  },
  x: {
    en: { handle: "@zoonkcom", url: "https://x.com/zoonkcom" },
    icon: IconBrandX,
    pt: { handle: "@zoonkbr", url: "https://x.com/zoonkbr" },
  },
  youtube: {
    en: { handle: "@zoonkcom", url: "https://www.youtube.com/@zoonkcom" },
    icon: IconBrandYoutube,
    pt: { handle: "@zoonkbr", url: "https://www.youtube.com/@zoonkbr" },
  },
} as const;

type ProfileName = keyof typeof PROFILES;

function getSocialProfile(name: ProfileName, locale: string) {
  const profile = PROFILES[name];
  return profile[isLocale(locale) ? locale : "en"];
}

function isLocale(locale: string): locale is "en" | "pt" {
  return (routing.locales as readonly string[]).includes(locale);
}

export function getSocialProfiles(locale: string) {
  return Object.entries(PROFILES).map(([name, data]) => ({
    icon: data.icon,
    name,
    ...getSocialProfile(name as ProfileName, locale),
  }));
}
