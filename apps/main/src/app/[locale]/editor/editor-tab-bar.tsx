"use client";

import { useExtracted } from "next-intl";
import { TabBar, TabBarItem } from "@/components/tab-bar";
import { getMenu } from "@/lib/menu";

const homeMenu = getMenu("home");
const editorMenu = getMenu("editor");

type EditorTabBarProps = {
  orgSlug?: string;
};

export function EditorTabBar({ orgSlug }: EditorTabBarProps) {
  const t = useExtracted();

  return (
    <TabBar>
      <TabBarItem
        exact
        href={homeMenu.url}
        icon={<homeMenu.icon aria-hidden="true" />}
        label={t("Home")}
      />

      {orgSlug && (
        <TabBarItem
          href={`/editor/${orgSlug}`}
          icon={<editorMenu.icon aria-hidden="true" />}
          label={t("Editor")}
        />
      )}
    </TabBar>
  );
}
