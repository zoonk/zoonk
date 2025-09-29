"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { useLogout } from "@/hooks/useLogout";
import { useRouter } from "@/i18n/navigation";
import { getMenuIcon } from "./menuIcons";
import { Button } from "./ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";

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
            <CommandItem onSelect={() => onSelectItem("/")}>
              {getMenuIcon("home")}
              {t("home")}
            </CommandItem>

            <CommandItem onSelect={() => onSelectItem("/courses")}>
              {getMenuIcon("courses")}
              {t("allCourses")}
            </CommandItem>

            <CommandItem onSelect={() => onSelectItem("/start")}>
              {getMenuIcon("start")}
              {t("start")}
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading={t("myAccount")}>
            {!isLoggedIn && (
              <CommandItem onSelect={() => onSelectItem("/login")}>
                {getMenuIcon("login")}
                {t("logInToAccount")}
              </CommandItem>
            )}

            {isLoggedIn && (
              <>
                <CommandItem onSelect={() => onSelectItem("/my")}>
                  {getMenuIcon("courses")}
                  {t("myCourses")}
                </CommandItem>

                <CommandItem onSelect={() => onSelectItem("/subscription")}>
                  {getMenuIcon("subscription")}
                  {t("manageSubscription")}
                </CommandItem>

                <CommandItem onSelect={() => onSelectItem("/settings")}>
                  {getMenuIcon("settings")}
                  {t("changeSettings")}
                </CommandItem>

                <CommandItem onSelect={logout}>
                  {getMenuIcon("logout")}
                  {t("logOutOfAccount")}
                </CommandItem>
              </>
            )}
          </CommandGroup>

          <CommandGroup heading={t("help")}>
            <CommandItem onSelect={() => onSelectItem("/feedback")}>
              {getMenuIcon("feedback")}
              {t("sendFeedback")}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
