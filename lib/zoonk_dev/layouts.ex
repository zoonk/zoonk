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
      %{icon: "tabler-bell-filled", color: "text-pink-600", module: :uiflash, label: "Flash", path: "/ui/flash"}
    ]
  end
end
