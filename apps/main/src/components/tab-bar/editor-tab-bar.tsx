"use client";

import { useExtracted } from "next-intl";
import { getMenu } from "@/lib/menu";
import { TabBar, TabBarItem } from "../tab-bar";

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
        icon={homeMenu.icon}
        label={t("Home")}
      />
      {orgSlug && (
        <TabBarItem
          href={`/editor/${orgSlug}`}
          icon={editorMenu.icon}
          label={t("Editor")}
        />
      )}
    </TabBar>
  );
}
