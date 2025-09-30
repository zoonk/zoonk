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
  courses: { url: "/courses", i18nKey: "courses", icon: LayoutGrid },
  displayName: { url: "/name", i18nKey: "displayName", icon: IdCardLanyard },
  feedback: { url: "/feedback", i18nKey: "feedback", icon: MessageCircle },
  follow: { url: "/follow", i18nKey: "follow", icon: Megaphone },
  help: { url: "/help", i18nKey: "help", icon: LifeBuoy },
  home: { url: "/", i18nKey: "home", icon: IconUfo },
  language: { url: "/language", i18nKey: "language", icon: Languages },
  login: { url: "/login", i18nKey: "login", icon: LogIn },
  logout: { url: "/logout", i18nKey: "logout", icon: LogOut },
  myCourses: { url: "/my", i18nKey: "myCourses", icon: LayoutGrid },
  search: { url: "/search", i18nKey: "search", icon: Search },
  settings: { url: "/settings", i18nKey: "settings", icon: Settings },
  start: { url: "/start", i18nKey: "start", icon: PlusCircle },
  subscription: { url: "/subscription", i18nKey: "subscription", icon: Gem },
} as const;

type MenuKey = keyof typeof menu;

export function getMenu(key: MenuKey) {
  return menu[key];
}
