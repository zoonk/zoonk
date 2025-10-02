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
  Instagram: {
    icon: IconBrandInstagram,
    en: { handle: "@zoonkcom", url: "https://www.instagram.com/zoonkcom" },
    pt: { handle: "@zoonkbr", url: "https://www.instagram.com/zoonkbr" },
  },
  X: {
    icon: IconBrandX,
    en: { handle: "@zoonkcom", url: "https://x.com/zoonkcom" },
    pt: { handle: "@zoonkbr", url: "https://x.com/zoonkbr" },
  },
  Threads: {
    icon: IconBrandThreads,
    en: { handle: "@zoonkcom", url: "https://www.threads.net/@zoonkcom" },
    pt: { handle: "@zoonkbr", url: "https://www.threads.net/@zoonkbr" },
  },
  YouTube: {
    icon: IconBrandYoutube,
    en: { handle: "@zoonkcom", url: "https://www.youtube.com/@zoonkcom" },
    pt: { handle: "@zoonkbr", url: "https://www.youtube.com/@zoonkbr" },
  },
  TikTok: {
    icon: IconBrandTiktok,
    en: { handle: "@zoonkcom", url: "https://www.tiktok.com/@zoonkcom" },
    pt: { handle: "@zoonkbr", url: "https://www.tiktok.com/@zoonkbr" },
  },
  LinkedIn: {
    icon: IconBrandLinkedin,
    en: { handle: "@zoonk", url: "https://www.linkedin.com/company/zoonk" },
    pt: { handle: "@zoonk", url: "https://www.linkedin.com/company/zoonk" },
  },
  Facebook: {
    icon: IconBrandFacebook,
    en: { handle: "@zoonkcom", url: "https://www.facebook.com/zoonkcom" },
    pt: { handle: "@zoonkbr", url: "https://www.facebook.com/zoonkbr" },
  },
  Reddit: {
    icon: IconBrandReddit,
    en: { handle: "r/zoonk", url: "https://www.reddit.com/r/zoonk" },
    pt: {
      handle: "r/ZoonkBrasil",
      url: "https://www.reddit.com/r/ZoonkBrasil",
    },
  },
  Bluesky: {
    icon: IconBrandBluesky,
    en: { handle: "@zoonk", url: "https://bsky.app/profile/zoonk.bsky.social" },
    pt: {
      handle: "@zoonkbr",
      url: "https://bsky.app/profile/zoonkbr.bsky.social",
    },
  },
} as const;

type ProfileName = keyof typeof PROFILES;
type Locale = (typeof routing.locales)[number];

function getSocialProfile(name: ProfileName, locale: string) {
  const profile = PROFILES[name];
  return profile[isLocale(locale) ? locale : "en"];
}

function isLocale(locale: string): locale is Locale {
  return (routing.locales as readonly string[]).includes(locale);
}

export function getSocialProfiles(locale: string) {
  return Object.entries(PROFILES).map(([name, data]) => ({
    name,
    icon: data.icon,
    ...getSocialProfile(name as ProfileName, locale),
  }));
}
