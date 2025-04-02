defmodule ZoonkWeb.Components.TabBar do
  @moduledoc """
  Tab bar components for mobile navigation.

  These components are useful for building a composable
  mobile tab bar with an iOS-like design.
  """
  use Phoenix.Component

  import ZoonkWeb.Components.Icon

  attr :class, :any, default: nil, doc: "Additional class for the tab bar"
  slot :inner_block, required: true, doc: "The inner block of the tab bar"

  def tab_bar(assigns) do
    ~H"""
    <nav class={[
      "fixed right-0 bottom-0 left-0 w-full lg:hidden",
      "bg-zk-background/80 backdrop-blur-lg",
      "border-zk-border border-t",
      "z-50",
      "md:sticky md:top-4 md:bottom-auto",
      "md:bg-zk-secondary md:rounded-full md:border-0",
      "md:min-w-md md:mx-auto md:max-w-xl md:py-1.5",
      @class
    ]}>
      <ul class="flex items-center justify-around px-2">
        {render_slot(@inner_block)}
      </ul>
    </nav>
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
          "flex flex-col items-center gap-1 px-3 py-1.5 transition-colors",
          "text-xs font-medium md:text-sm",
          "md:rounded-full md:hover:bg-zk-background",
          @active && "text-zk-primary bg-zk-background md:font-semibold",
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
