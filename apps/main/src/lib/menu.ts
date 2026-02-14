import {
  Brain,
  Gem,
  Home,
  IdCardLanyard,
  Languages,
  LayoutGrid,
  LifeBuoy,
  LogIn,
  LogOut,
  Search,
  Settings,
  TargetIcon,
  ZapIcon,
} from "lucide-react";

const menu = {
  courses: { icon: LayoutGrid, url: "/courses" },
  energy: { icon: ZapIcon, url: "/energy" },
  home: { icon: Home, url: "/" },
  language: { icon: Languages, url: "/language" },
  learn: { icon: Brain, url: "/learn" },
  level: { icon: Brain, url: "/level" },
  login: { icon: LogIn, url: "/login" },
  logout: { icon: LogOut, url: "/logout" },
  myCourses: { icon: LayoutGrid, url: "/my" },
  profile: { icon: IdCardLanyard, url: "/profile" },
  score: { icon: TargetIcon, url: "/score" },
  search: { icon: Search, url: "/search" },
  settings: { icon: Settings, url: "/settings" },
  subscription: { icon: Gem, url: "/subscription" },
  support: { icon: LifeBuoy, url: "/support" },
} as const;

export function getMenu(key: keyof typeof menu) {
  return menu[key];
}
