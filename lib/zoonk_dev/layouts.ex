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
      %{icon: "tabler-pointer-filled", color: "text-red-600", module: :uibutton, label: "Button", path: "/ui/button"}
    ]
  end
end
