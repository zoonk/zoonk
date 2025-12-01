import { EditorTabBar } from "./editor-tab-bar";

type EditorHeaderProps = {
  orgSlug?: string;
  children?: React.ReactNode;
};

export function EditorHeader({ orgSlug, children }: EditorHeaderProps) {
  return (
    <>
      {children && <div className="flex justify-end p-4">{children}</div>}
      <EditorTabBar orgSlug={orgSlug} />
    </>
  );
}
