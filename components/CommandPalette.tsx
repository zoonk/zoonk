"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { useLogout } from "@/hooks/useLogout";
import { Link } from "@/i18n/navigation";
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
  const { isLoggedIn, logout } = useLogout();
  const { isOpen, open, close } = useKeyboardShortcut("k");
  const [query, setQuery] = useState("");

  const t = useTranslations("Menu");

  const closePalette = useCallback(() => {
    close();
    setQuery("");
  }, [close]);

  return (
    <>
      <Button variant="outline" size="icon" onClick={open}>
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
            <CommandItem asChild>
              <Link href="/">
                {getMenuIcon("home")}
                {t("home")}
              </Link>
            </CommandItem>

            <CommandItem asChild>
              <Link href="/courses">
                {getMenuIcon("courses")}
                {t("allCourses")}
              </Link>
            </CommandItem>

            <CommandItem asChild>
              <Link href="/start">
                {getMenuIcon("start")}
                {t("start")}
              </Link>
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading={t("myAccount")}>
            {!isLoggedIn && (
              <CommandItem asChild>
                <Link href="/login">
                  {getMenuIcon("login")}
                  {t("loginIntoAccount")}
                </Link>
              </CommandItem>
            )}

            {isLoggedIn && (
              <>
                <CommandItem asChild>
                  <Link href="/my">
                    {getMenuIcon("courses")}
                    {t("myCourses")}
                  </Link>
                </CommandItem>

                <CommandItem asChild>
                  <Link href="/subscription">
                    {getMenuIcon("subscription")}
                    {t("manageSubscription")}
                  </Link>
                </CommandItem>

                <CommandItem asChild>
                  <Link href="/settings">
                    {getMenuIcon("settings")}
                    {t("changeSettings")}
                  </Link>
                </CommandItem>

                <CommandItem onSelect={logout}>
                  {getMenuIcon("logout")}
                  {t("logoutFromAccount")}
                </CommandItem>
              </>
            )}
          </CommandGroup>

          <CommandGroup heading={t("help")}>
            <CommandItem asChild>
              <Link href="/feedback">
                {getMenuIcon("feedback")}
                {t("contact")}
              </Link>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
