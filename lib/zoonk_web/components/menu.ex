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
      id="sidebar"
      class={[
        "hidden lg:block",
        "h-dvh sticky top-0 bottom-0 left-0 w-80",
        "scrollbar-none overflow-y-auto overflow-x-hidden",
        "bg-zk-secondary/75",
        "border-zk-border contrast-more:border-r"
      ]}
    >
      {render_slot(@inner_block)}
    </aside>

    <section
      id="tabbar"
      class={[
        "fixed right-0 bottom-0 left-0 w-full lg:hidden",
        "bg-zk-background/80 backdrop-blur-lg",
        "border-zk-border border-t",
        "z-10",
        "md:sticky md:top-0 md:bottom-auto md:p-4",
        "md:border-0",
        "md:data-[scrolled=true]:top-0 md:data-[scrolled=true]:w-full",
        "md:data-[scrolled=true]:bg-zk-secondary/30"
      ]}
      phx-hook="ToolbarScroll"
      data-scrolled="false"
    >
      {render_slot(@inner_block)}
    </section>
    """
  end

  attr :heading, :string, default: nil, doc: "Optional heading for the menu group"
  attr :primary, :boolean, default: false, doc: "Whether this is a primary menu group that shows on all breakpoints"
  slot :inner_block, required: true, doc: "The inner block of the menu group"

  def menu_group(assigns) do
    ~H"""
    <section
      :if={@primary || (!@primary && assigns.__changed__[:class])}
      id={"menu-group-#{System.unique_integer([:positive])}"}
      class={["lg:p-4", @primary && "md:p-0"]}
    >
      <h4
        :if={@heading && (!@primary || (@primary && assigns.__changed__[:heading]))}
        class="text-zk-muted-foreground/70 hidden px-4 pb-2 text-xs font-medium lg:block"
      >
        {@heading}
      </h4>

      <nav class={[
        @primary && "md:bg-zk-secondary-accent/80 md:rounded-full",
        @primary && "md:mx-auto md:w-fit md:max-w-xl md:py-1"
      ]}>
        <ul class={[
          "lg:flex lg:w-full lg:min-w-0 lg:flex-col lg:gap-1",
          @primary && "flex items-center justify-around px-2 md:gap-1.5 md:px-1"
        ]}>
          {render_slot(@inner_block)}
        </ul>
      </nav>
    </section>
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
          class={[!@destructive && "lg:text-zk-primary", @primary && "md:hidden"]}
          size={@primary && :md}
        />
        <span class={["lg:truncate", @primary && "truncate"]}>{@label}</span>
      </.link>
    </li>
    """
  end
end
