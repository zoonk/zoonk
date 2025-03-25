defmodule ZoonkWeb.Components.Sidebar do
  @moduledoc """
  Sidebar components.

  These components are useful for building a
  composable sidebar.
  """
  use Phoenix.Component

  import ZoonkWeb.Components.Icon

  attr :class, :any, default: nil, doc: "Additional class for the sidebar"

  slot :inner_block, required: true, doc: "The inner block of the sidebar"

  def sidebar(assigns) do
    ~H"""
    <aside class={[
      "hidden lg:block",
      "h-dvh sticky top-0 bottom-0 left-0 w-64",
      "overflow-y-auto overflow-x-hidden",
      "bg-zk-surface",
      "border-zk-border border-r",
      @class
    ]}>
      {render_slot(@inner_block)}
    </aside>
    """
  end

  attr :class, :any, default: nil, doc: "Additional class for the sidebar menu"

  slot :inner_block, required: true, doc: "The inner block of the sidebar menu"

  def sidebar_menu(assigns) do
    ~H"""
    <ul class={["flex w-full min-w-0 flex-col gap-1 p-4", @class]}>
      {render_slot(@inner_block)}
    </ul>
    """
  end

  attr :active, :boolean, default: false, doc: "Whether the menu item is active"
  attr :class, :any, default: nil, doc: "Additional class for the sidebar menu item"

  slot :inner_block, required: true, doc: "The inner block of the sidebar menu item"

  def sidebar_menu_item(assigns) do
    ~H"""
    <li class={["group relative", @class]}>
      {render_slot(@inner_block)}
    </li>
    """
  end

  attr :active, :boolean, default: false, doc: "Whether the link is active"
  attr :class, :any, default: nil, doc: "Additional class for the sidebar menu link"
  attr :icon, :string, required: false, doc: "The icon name to display"
  attr :rest, :global, include: ~w(href method navigate patch), doc: "HTML attributes to apply to the link"

  slot :inner_block, required: true, doc: "The inner block of the sidebar menu link"

  def sidebar_menu_link(assigns) do
    ~H"""
    <.link
      class={[
        "flex w-full items-center gap-3 rounded-md px-3 py-2",
        "text-sm transition-colors",
        "hover:bg-zk-secondary",
        "focus-visible:ring-zk-ring focus-visible:outline-0 focus-visible:ring-2",
        @active &&
          "bg-zk-primary-subtle/90 text-zk-primary-subtle-foreground hover:bg-zk-primary-subtle",
        !@active && "text-zk-muted-foreground",
        @class
      ]}
      {@rest}
    >
      <.icon :if={@icon} name={@icon} />
      <span class="truncate">{render_slot(@inner_block)}</span>
    </.link>
    """
  end
end
