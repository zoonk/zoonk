defmodule ZoonkDev.Layouts do
  @moduledoc """
  This module holds different layouts used by your dev environment.
  """
  use ZoonkWeb, :html

  embed_templates "layouts/*"

  def menu_items do
    [
      %{icon: "tabler-home", color: "text-slate-600", module: :uihome, label: "Home", path: "/ui"},
      %{icon: "tabler-link", color: "text-blue-600", module: :uianchor, label: "Anchor", path: "/ui/anchor"}
    ]
  end
end
