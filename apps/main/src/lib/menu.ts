import { IconUfo } from "@tabler/icons-react";
import {
  Gem,
  IdCardLanyard,
  Languages,
  LayoutGrid,
  LifeBuoy,
  LogIn,
  LogOut,
  Megaphone,
  MessageCircle,
  PlusCircle,
  Search,
  Settings,
} from "lucide-react";

const menu = {
  courses: { icon: LayoutGrid, url: "/courses" },
  displayName: { icon: IdCardLanyard, url: "/name" },
  feedback: { icon: MessageCircle, url: "/feedback" },
  follow: { icon: Megaphone, url: "/follow" },
  help: { icon: LifeBuoy, url: "/help" },
  home: { icon: IconUfo, url: "/" },
  language: { icon: Languages, url: "/language" },
  login: { icon: LogIn, url: "/login" },
  logout: { icon: LogOut, url: "/logout" },
  myCourses: { icon: LayoutGrid, url: "/my" },
  search: { icon: Search, url: "/search" },
  settings: { icon: Settings, url: "/settings" },
  start: { icon: PlusCircle, url: "/learn" },
  subscription: { icon: Gem, url: "/subscription" },
} as const;

type MenuKey = keyof typeof menu;

export function getMenu(key: MenuKey) {
  return menu[key];
}
