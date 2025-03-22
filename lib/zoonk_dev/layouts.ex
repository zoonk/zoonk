defmodule ZoonkDev.Layouts do
  @moduledoc """
  This module holds different layouts used by your dev environment.
  """
  use ZoonkWeb, :html

  embed_templates "layouts/*"

  def menu_items do
    [
      %{icon: "tabler-ufo", color: "text-slate-500", module: :uihome, label: "Home", path: "/ui"},
      %{icon: "tabler-link", color: "text-blue-500", module: :uianchor, label: "Anchor", path: "/ui/anchor"},
      %{icon: "tabler-user-circle", color: "text-green-500", module: :uiavatar, label: "Avatar", path: "/ui/avatar"},
      %{icon: "tabler-pointer-filled", color: "text-red-500", module: :uibutton, label: "Button", path: "/ui/button"},
      %{icon: "tabler-app-window-filled", color: "text-gray-500", module: :uicard, label: "Card", path: "/ui/card"},
      %{
        icon: "tabler-arrows-right-left",
        color: "text-yellow-500",
        module: :uidivider,
        label: "Divider",
        path: "/ui/divider"
      },
      %{icon: "tabler-bell-filled", color: "text-pink-500", module: :uiflash, label: "Flash", path: "/ui/flash"},
      %{icon: "tabler-forms", color: "text-purple-500", module: :uiform, label: "Form", path: "/ui/form"},
      %{icon: "tabler-cursor-text", color: "text-orange-500", module: :uiinput, label: "Input", path: "/ui/input"},
      %{icon: "tabler-typography", color: "text-teal-500", module: :uitext, label: "Text", path: "/ui/text"}
    ]
  end
end
