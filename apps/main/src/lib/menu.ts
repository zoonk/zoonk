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
  displayName: { icon: IdCardLanyard, url: "/name" },
  energy: { icon: ZapIcon, url: "/energy" },
  home: { icon: Home, url: "/" },
  language: { icon: Languages, url: "/language" },
  learn: { icon: Brain, url: "/learn" },
  level: { icon: Brain, url: "/level" },
  login: { icon: LogIn, url: "/login" },
  logout: { icon: LogOut, url: "/logout" },
  myCourses: { icon: LayoutGrid, url: "/my" },
  score: { icon: TargetIcon, url: "/score" },
  search: { icon: Search, url: "/search" },
  settings: { icon: Settings, url: "/settings" },
  subscription: { icon: Gem, url: "/subscription" },
  support: { icon: LifeBuoy, url: "/support" },
} as const;

type MenuKey = keyof typeof menu;

export function getMenu(key: MenuKey) {
  return menu[key];
}
