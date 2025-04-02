defmodule ZoonkWeb.Components.TabBar do
  @moduledoc """
  Tab bar components for mobile navigation.

  These components are useful for building a composable
  mobile tab bar with an iOS-like design.
  """
  use Phoenix.Component

  import ZoonkWeb.Components.Icon

  attr :class, :any, default: nil, doc: "Additional class for the tab bar"
  attr :id, :string, default: "tab-bar", doc: "ID for the tab bar"
  slot :inner_block, required: true, doc: "The inner block of the tab bar"

  def tab_bar(assigns) do
    ~H"""
    <section
      id={@id}
      class={[
        "fixed right-0 bottom-0 left-0 w-full lg:hidden",
        "bg-zk-background/80 backdrop-blur-lg",
        "border-zk-border border-t",
        "z-50",
        "md:sticky md:top-0 md:bottom-auto md:p-4",
        "md:border-0",
        "md:data-[scrolled=true]:top-0 md:data-[scrolled=true]:w-full",
        "md:data-[scrolled=true]:bg-zk-secondary/70"
      ]}
      phx-hook="TabBarScroll"
      data-scrolled="false"
    >
      <nav
        id={@id}
        class={[
          "md:bg-zk-secondary-accent/80 md:rounded-full",
          "md:mx-auto md:w-fit md:max-w-xl md:py-1.5",
          @class
        ]}
      >
        <ul class="flex items-center justify-around px-2 md:gap-1.5 md:px-1.5">
          {render_slot(@inner_block)}
        </ul>
      </nav>
    </section>
    """
  end

  attr :active, :boolean, default: false, doc: "Whether the tab is active"
  attr :icon, :string, required: true, doc: "The icon name to display"
  attr :label, :string, required: true, doc: "The label text to display"
  attr :rest, :global, include: ~w(href method navigate patch), doc: "HTML attributes to apply to the link"

  def tab_bar_item(assigns) do
    ~H"""
    <li class="flex-1">
      <.link
        class={[
          "flex flex-col items-center gap-1 px-3 py-1.5",
          "transition-colors",
          "text-xs font-medium md:text-sm",
          "md:rounded-full",
          @active && "text-zk-primary md:bg-zk-background md:font-semibold",
          !@active && "text-zk-muted-foreground md:text-zk-secondary-foreground md:font-normal"
        ]}
        {@rest}
      >
        <.icon name={@icon} size={:md} class="md:hidden" />
        <span>{@label}</span>
      </.link>
    </li>
    """
  end
end
