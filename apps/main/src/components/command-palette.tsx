"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@zoonk/ui/components/command";
import { useKeyboardShortcut } from "@zoonk/ui/hooks/use-keyboard-shortcut";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { usei18nLogout } from "@/hooks/use-logout";
import { useRouter } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";

const logoutMenu = getMenu("logout");

export function CommandPalette() {
  const { push } = useRouter();
  const { isLoggedIn, logout } = usei18nLogout();
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

  const getStarted = [
    { key: t("home"), ...getMenu("home") },
    { key: t("courses"), ...getMenu("courses") },
    { key: t("start"), ...getMenu("start") },
  ];

  const accountPublic = [{ key: t("login"), ...getMenu("login") }];

  const accountPrivate = [
    { key: t("courses"), ...getMenu("myCourses") },
    { key: t("subscription"), ...getMenu("subscription") },
    { key: t("settings"), ...getMenu("settings") },
    { key: t("language"), ...getMenu("language") },
    { key: t("displayName"), ...getMenu("displayName") },
  ];

  const contactUs = [
    { key: t("feedback"), ...getMenu("feedback") },
    { key: t("help"), ...getMenu("help") },
    { key: t("follow"), ...getMenu("follow") },
  ];

  return (
    <>
      <Button
        aria-keyshortcuts="Meta+K Control+K"
        onClick={open}
        size="icon"
        variant="outline"
      >
        <Search />
        <span className="sr-only">{t("search")}</span>
      </Button>

      <CommandDialog
        className="top-4 translate-y-0 lg:top-1/2 lg:translate-y-[-50%]"
        closeLabel={t("close")}
        description={t("paletteDescription")}
        onOpenChange={closePalette}
        open={isOpen}
        title={t("search")}
      >
        <CommandInput
          onValueChange={setQuery}
          placeholder={t("paletteDescription")}
          value={query}
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
                {item.key}
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
                  {item.key}
                </CommandItem>
              ))}

            {isLoggedIn &&
              accountPrivate.map((item) => (
                <CommandItem
                  key={item.key}
                  onSelect={() => onSelectItem(item.url)}
                >
                  <item.icon aria-hidden="true" />
                  {item.key}
                </CommandItem>
              ))}

            {isLoggedIn && (
              <CommandItem onSelect={logout}>
                <logoutMenu.icon aria-hidden="true" />
                {t("logout")}
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
                {item.key}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
