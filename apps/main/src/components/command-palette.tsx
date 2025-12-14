"use client";

import { useLogout } from "@zoonk/auth/hooks/logout";
import { Button } from "@zoonk/ui/components/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@zoonk/ui/components/command";
import { useKeyboardCallback } from "@zoonk/ui/hooks/use-keyboard";
import { Search } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";

const logoutMenu = getMenu("logout");

export function CommandPalette() {
  const { push } = useRouter();
  const t = useExtracted();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { isLoggedIn, logout } = useLogout({ onSuccess: () => push("/login") });

  useKeyboardCallback("k", () => setIsOpen((prev) => !prev));

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  const closePalette = () => {
    close();
    setQuery("");
  };

  const onSelectItem = (item: string) => {
    closePalette();
    push(item);
  };

  const getStarted = [
    { key: t("Home page"), ...getMenu("home") },
    { key: t("Courses"), ...getMenu("courses") },
    { key: t("Learn something"), ...getMenu("learn") },
  ];

  const accountPublic = [
    { key: t("Login"), ...getMenu("login") },
    { key: t("Language"), ...getMenu("language") },
  ];

  const accountPrivate = [
    { key: t("My courses"), ...getMenu("myCourses") },
    { key: t("Manage subscription"), ...getMenu("subscription") },
    { key: t("Manage settings"), ...getMenu("settings") },
    { key: t("Update language"), ...getMenu("language") },
    { key: t("Update display name"), ...getMenu("displayName") },
  ];

  const contactUs = [
    { key: t("Send feedback"), ...getMenu("feedback") },
    { key: t("Help and support"), ...getMenu("help") },
    { key: t("Follow us on social media"), ...getMenu("follow") },
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
        <span className="sr-only">{t("Search")}</span>
      </Button>

      <CommandDialog
        className="top-4 translate-y-0 lg:top-1/2 lg:translate-y-[-50%]"
        closeLabel={t("Close search")}
        description={t("Search courses or pages...")}
        onOpenChange={closePalette}
        open={isOpen}
        title={t("Search")}
      >
        <CommandInput
          onValueChange={setQuery}
          placeholder={t("Search courses or pages...")}
          value={query}
        />

        <CommandList>
          <CommandEmpty>
            <p>{t("No results found")}</p>
          </CommandEmpty>

          <CommandGroup heading={t("Get started")}>
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

          <CommandGroup heading={t("My account")}>
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
                {t("Logout")}
              </CommandItem>
            )}
          </CommandGroup>

          <CommandGroup heading={t("Contact us")}>
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
