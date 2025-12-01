import {
  Brain,
  Gem,
  Home,
  IdCardLanyard,
  Languages,
  LayoutGrid,
  LayoutTemplate,
  LifeBuoy,
  LogIn,
  LogOut,
  Megaphone,
  MessageCircle,
  Search,
  Settings,
} from "lucide-react";

const menu = {
  courses: { icon: LayoutGrid, url: "/courses" },
  displayName: { icon: IdCardLanyard, url: "/name" },
  editor: { icon: LayoutTemplate, url: "/editor" },
  feedback: { icon: MessageCircle, url: "/feedback" },
  follow: { icon: Megaphone, url: "/follow" },
  help: { icon: LifeBuoy, url: "/help" },
  home: { icon: Home, url: "/" },
  language: { icon: Languages, url: "/language" },
  learn: { icon: Brain, url: "/learn" },
  login: { icon: LogIn, url: "/login" },
  logout: { icon: LogOut, url: "/logout" },
  myCourses: { icon: LayoutGrid, url: "/my" },
  search: { icon: Search, url: "/search" },
  settings: { icon: Settings, url: "/settings" },
  subscription: { icon: Gem, url: "/subscription" },
} as const;

type MenuKey = keyof typeof menu;

export function getMenu(key: MenuKey) {
  return menu[key];
}
