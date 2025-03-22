defmodule ZoonkDev.Layouts do
  @moduledoc """
  This module holds different layouts used by your dev environment.
  """
  use ZoonkWeb, :html

  embed_templates "layouts/*"

  def menu_items do
    [
      %{icon: "tabler-home-filled", color: "text-slate-600", module: :uihome, label: "Home", path: "/ui"},
      %{icon: "tabler-link", color: "text-blue-600", module: :uianchor, label: "Anchor", path: "/ui/anchor"},
      %{icon: "tabler-user-circle", color: "text-green-600", module: :uiavatar, label: "Avatar", path: "/ui/avatar"},
      %{icon: "tabler-pointer-filled", color: "text-red-600", module: :uibutton, label: "Button", path: "/ui/button"},
      %{icon: "tabler-app-window-filled", color: "text-gray-600", module: :uicard, label: "Card", path: "/ui/card"},
      %{
        icon: "tabler-arrows-right-left",
        color: "text-yellow-600",
        module: :uidivider,
        label: "Divider",
        path: "/ui/divider"
      },
      %{icon: "tabler-bell-filled", color: "text-pink-600", module: :uiflash, label: "Flash", path: "/ui/flash"},
      %{icon: "tabler-forms", color: "text-purple-600", module: :uiform, label: "Form", path: "/ui/form"},
      %{icon: "tabler-cursor-text", color: "text-orange-600", module: :uiinput, label: "Input", path: "/ui/input"},
      %{icon: "tabler-typography", color: "text-teal-600", module: :uitext, label: "Text", path: "/ui/text"}
    ]
  end
end
