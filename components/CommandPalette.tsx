"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { useLogout } from "@/hooks/useLogout";
import { useRouter } from "@/i18n/navigation";
import { getMenu } from "./menu";
import { Button } from "./ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";

const getStarted = [
  { key: "home", ...getMenu("home") },
  { key: "courses", ...getMenu("courses") },
  { key: "start", ...getMenu("start") },
];

const accountPublic = [{ key: "login", ...getMenu("login") }];

const accountPrivate = [
  { key: "courses", ...getMenu("myCourses") },
  { key: "subscription", ...getMenu("subscription") },
  { key: "settings", ...getMenu("settings") },
  { key: "language", ...getMenu("language") },
  { key: "displayName", ...getMenu("displayName") },
];

const contactUs = [
  { key: "feedback", ...getMenu("feedback") },
  { key: "help", ...getMenu("help") },
  { key: "follow", ...getMenu("follow") },
];

const logoutMenu = getMenu("logout");

export function CommandPalette() {
  const { push } = useRouter();
  const { isLoggedIn, logout } = useLogout();
  const { isOpen, open, close } = useKeyboardShortcut("k");
  const [query, setQuery] = useState("");

  const t = useTranslations("Menu");

  const closePalette = useCallback(() => {
    close();
    setQuery("");
  }, [close]);

  const onSelectItem = useCallback(
    (item: string) => {
      closePalette();
      push(item);
    },
    [push, closePalette],
  );

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={open}
        aria-keyshortcuts="Meta+K Control+K"
      >
        <Search />
        <span className="sr-only">{t("search")}</span>
      </Button>

      <CommandDialog
        open={isOpen}
        onOpenChange={closePalette}
        title={t("search")}
        description={t("paletteDescription")}
        closeLabel={t("close")}
      >
        <CommandInput
          placeholder={t("paletteDescription")}
          value={query}
          onValueChange={setQuery}
        />

        <CommandList>
          <CommandEmpty>
            <p>{t("noResults")}</p>
          </CommandEmpty>

          <CommandGroup heading={t("getStarted")}>
            {getStarted.map((item) => (
              <CommandItem
                key={item.key}
                onSelect={() => onSelectItem(item.url)}
              >
                <item.icon aria-hidden="true" />
                {t(item.i18nKey)}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading={t("myAccount")}>
            {!isLoggedIn &&
              accountPublic.map((item) => (
                <CommandItem
                  key={item.key}
                  onSelect={() => onSelectItem(item.url)}
                >
                  <item.icon aria-hidden="true" />
                  {t(item.i18nKey)}
                </CommandItem>
              ))}

            {isLoggedIn &&
              accountPrivate.map((item) => (
                <CommandItem
                  key={item.key}
                  onSelect={() => onSelectItem(item.url)}
                >
                  <item.icon aria-hidden="true" />
                  {t(item.i18nKey)}
                </CommandItem>
              ))}

            {isLoggedIn && (
              <CommandItem onSelect={logout}>
                <logoutMenu.icon aria-hidden="true" />
                {t(logoutMenu.i18nKey)}
              </CommandItem>
            )}
          </CommandGroup>

          <CommandGroup heading={t("contactUs")}>
            {contactUs.map((item) => (
              <CommandItem
                key={item.key}
                onSelect={() => onSelectItem(item.url)}
              >
                <item.icon aria-hidden="true" />
                {t(item.i18nKey)}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
