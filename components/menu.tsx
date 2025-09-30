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
  courses: { url: "/courses", icon: LayoutGrid },
  displayName: { url: "/name", icon: IdCardLanyard },
  feedback: { url: "/feedback", icon: MessageCircle },
  follow: { url: "/follow", icon: Megaphone },
  help: { url: "/help", icon: LifeBuoy },
  home: { url: "/", icon: IconUfo },
  language: { url: "/language", icon: Languages },
  login: { url: "/login", icon: LogIn },
  logout: { url: "/logout", icon: LogOut },
  myCourses: { url: "/my", icon: LayoutGrid },
  search: { url: "/search", icon: Search },
  settings: { url: "/settings", icon: Settings },
  start: { url: "/start", icon: PlusCircle },
  subscription: { url: "/subscription", icon: Gem },
} as const;

type MenuKey = keyof typeof menu;

export function getMenu(key: MenuKey) {
  return menu[key];
}
