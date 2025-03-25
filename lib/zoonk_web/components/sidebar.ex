defmodule ZoonkWeb.Components.Sidebar do
  @moduledoc """
  Sidebar components.

  These components are useful for building a
  composable sidebar.
  """
  use Phoenix.Component

  import ZoonkWeb.Components.Icon
  import ZoonkWeb.Components.Text

  attr :class, :any, default: nil, doc: "Additional class for the sidebar"
  slot :inner_block, required: true, doc: "The inner block of the sidebar"

  def sidebar(assigns) do
    ~H"""
    <aside class={[
      "hidden lg:block",
      "h-dvh sticky top-0 bottom-0 left-0 w-64",
      "scrollbar-none overflow-y-auto overflow-x-hidden",
      "bg-zk-muted/70",
      "border-zk-border border-r",
      @class
    ]}>
      {render_slot(@inner_block)}
    </aside>
    """
  end

  attr :heading, :string, default: nil, doc: "Optional heading for the sidebar menu"
  attr :class, :any, default: nil, doc: "Additional class for the sidebar menu"
  slot :inner_block, required: true, doc: "The inner block of the sidebar menu"

  def sidebar_menu(assigns) do
    ~H"""
    <section class="p-4">
      <.text
        :if={@heading}
        tag="h4"
        variant={:custom}
        size={:small}
        class="text-zk-muted-foreground/70 px-2 pb-2 font-medium"
      >
        {@heading}
      </.text>

      <ul class={["flex w-full min-w-0 flex-col gap-1", @class]}>
        {render_slot(@inner_block)}
      </ul>
    </section>
    """
  end

  attr :active, :boolean, default: false, doc: "Whether the link is active"
  attr :destructive, :boolean, default: false, doc: "Indicates if the link is destructive"
  attr :icon, :string, required: false, doc: "The icon name to display"
  attr :rest, :global, include: ~w(href method navigate patch), doc: "HTML attributes to apply to the link"
  slot :inner_block, required: true, doc: "The inner block of the sidebar menu link"

  def sidebar_menu_item(assigns) do
    ~H"""
    <li aria-current={@active && "page"}>
      <.link
        class={[
          "flex w-full items-center gap-3 rounded-md px-3 py-2",
          "text-sm transition-colors",
          "hover:bg-zk-secondary",
          "focus-visible:ring-zk-ring focus-visible:outline-0 focus-visible:ring-2",
          @active && !@destructive &&
            "bg-zk-primary-subtle/90 text-zk-primary-subtle-foreground hover:bg-zk-primary-subtle",
          !@active && !@destructive && "text-zk-muted-foreground",
          @destructive && "text-zk-destructive-text"
        ]}
        {@rest}
      >
        <.icon :if={@icon} name={@icon} />
        <span class="truncate">{render_slot(@inner_block)}</span>
      </.link>
    </li>
    """
  end
end
