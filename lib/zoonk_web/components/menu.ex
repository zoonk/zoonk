defmodule ZoonkWeb.Components.Menu do
  @moduledoc """
  Menu components for navigation.

  These components provide a responsive navigation system that adapts to different screen sizes:
  - On desktop and tablet landscape (lg and up): Sidebar-style navigation on the left
  - On mobile and tablet portrait (md and down): Tab bar navigation at the bottom/top
  """
  use Phoenix.Component

  import ZoonkWeb.Components.Icon

  slot :inner_block, required: true, doc: "The inner block of the menu"

  def menu(assigns) do
    ~H"""
    <aside
      id="app-menu"
      class={[
        "fixed right-0 bottom-0 left-0 w-full",
        "bg-zk-background/80 backdrop-blur-lg",
        "border-zk-border border-t",
        "z-10",
        "md:sticky md:top-0 md:bottom-auto md:p-4",
        "md:border-0",
        "md:max-lg:data-[scrolled=true]:top-0 md:max-lg:data-[scrolled=true]:w-full",
        "md:max-lg:data-[scrolled=true]:bg-zk-secondary/30",
        "lg:h-dvh lg:bottom-0 lg:block lg:w-80",
        "lg:scrollbar-none lg:overflow-y-auto lg:overflow-x-hidden",
        "lg:bg-zk-secondary/75",
        "lg:contrast-more:border-r"
      ]}
      phx-hook="ToolbarScroll"
      data-scrolled="false"
    >
      {render_slot(@inner_block)}
    </aside>
    """
  end

  attr :heading, :string, default: nil, doc: "Optional heading for the menu group"
  attr :primary, :boolean, default: false, doc: "Whether this is a primary menu group that shows on all breakpoints"
  slot :inner_block, required: true, doc: "The inner block of the menu group"

  def menu_group(%{primary: true} = assigns) do
    ~H"""
    <div>
      <.sidebar_menu heading={@heading}>{render_slot(@inner_block)}</.sidebar_menu>

      <nav class={[
        "md:bg-zk-secondary-accent/80 md:rounded-full",
        "md:mx-auto md:w-fit md:max-w-xl md:py-1",
        "lg:hidden"
      ]}>
        <ul class="flex items-center justify-around px-2 md:gap-1.5 md:px-1">
          {render_slot(@inner_block)}
        </ul>
      </nav>
    </div>
    """
  end

  def menu_group(%{primary: false} = assigns) do
    ~H"""
    <.sidebar_menu heading={@heading}>
      {render_slot(@inner_block)}
    </.sidebar_menu>
    """
  end

  attr :active, :boolean, default: false, doc: "Whether the menu item is active"
  attr :destructive, :boolean, default: false, doc: "Indicates if the menu item is destructive"
  attr :icon, :string, required: false, doc: "The icon name to display"
  attr :label, :string, required: true, doc: "The label text to display"
  attr :primary, :boolean, default: false, doc: "Whether this is a primary menu item that shows on all breakpoints"
  attr :rest, :global, include: ~w(href method navigate patch), doc: "HTML attributes to apply to the link"

  def menu_item(assigns) do
    ~H"""
    <li aria-current={@active && "page"} class={[@primary && "md:flex-1"]}>
      <.link
        class={[
          "lg:flex lg:w-full lg:items-center lg:gap-3 lg:rounded-md lg:px-3 lg:py-2.5",
          "lg:text-base lg:transition-colors",
          "lg:hover:bg-zk-background lg:hover:shadow-sm",
          "lg:focus-visible:ring-zk-ring lg:focus-visible:outline-0 lg:focus-visible:ring-2",
          @active && !@destructive && "lg:bg-zk-background lg:text-zk-primary lg:shadow-sm",
          !@active && !@destructive && "lg:text-zk-secondary-foreground",
          @destructive && "lg:text-zk-destructive-text",
          @primary && "flex flex-col items-center gap-1 px-3 py-1.5",
          @primary && "transition-colors",
          @primary && "text-xs font-medium md:text-sm",
          @primary && "md:rounded-full",
          @primary && @active && "text-zk-primary md:bg-zk-background md:font-semibold",
          @primary && !@active &&
            "text-zk-muted-foreground md:text-zk-secondary-foreground md:font-normal"
        ]}
        {@rest}
      >
        <.icon
          :if={@icon}
          name={@icon}
          class={[!@destructive && "lg:text-zk-primary", "md:max-lg:hidden"]}
          size={:md}
        />
        <span class="truncate">{@label}</span>
      </.link>
    </li>
    """
  end

  defp sidebar_menu(assigns) do
    ~H"""
    <section class="hidden p-4 lg:block">
      <h4 :if={@heading} class="text-zk-muted-foreground/70 px-4 pb-2 text-xs font-medium">
        {@heading}
      </h4>

      <ul class="flex w-full min-w-0 flex-col gap-1">
        {render_slot(@inner_block)}
      </ul>
    </section>
    """
  end
end
