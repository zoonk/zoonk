defmodule ZoonkWeb.Components.Sidebar do
  @moduledoc """
  Sidebar components.

  These components are useful for building a
  composable sidebar.
  """
  use Phoenix.Component

  attr :class, :any, default: nil, doc: "Additional class for the sidebar"

  slot :inner_block, required: true, doc: "The inner block of the sidebar"

  def sidebar(assigns) do
    ~H"""
    <aside class={[
      "hidden lg:block",
      "h-dvh sticky top-0 bottom-0 left-0 w-64",
      "overflow-y-auto overflow-x-hidden",
      "bg-zk-background",
      "border-zk-border border-r",
      @class
    ]}>
      {render_slot(@inner_block)}
    </aside>
    """
  end
end
