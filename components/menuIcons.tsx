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

const menuIcons = {
  courses: <LayoutGrid aria-hidden="true" />,
  displayName: <IdCardLanyard aria-hidden="true" />,
  feedback: <MessageCircle aria-hidden="true" />,
  follow: <Megaphone aria-hidden="true" />,
  help: <LifeBuoy aria-hidden="true" />,
  home: <IconUfo aria-hidden="true" />,
  language: <Languages aria-hidden="true" />,
  login: <LogIn aria-hidden="true" />,
  logout: <LogOut aria-hidden="true" />,
  search: <Search aria-hidden="true" />,
  settings: <Settings aria-hidden="true" />,
  start: <PlusCircle aria-hidden="true" />,
  subscription: <Gem aria-hidden="true" />,
} as const;

export function getMenuIcon(page: keyof typeof menuIcons) {
  return menuIcons[page];
}
