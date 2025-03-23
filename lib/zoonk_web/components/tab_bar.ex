defmodule ZoonkWeb.Components.TabBar do
  @moduledoc """
  Tab bar component.
  """
  use Phoenix.Component
  use Gettext, backend: Zoonk.Gettext

  import ZoonkWeb.Components.Icon

  @doc """
  Navigation menu item.

  Renders a menu item to be displayed at the bottom of the page.
  """
  attr :label, :string, required: true
  attr :icon, :string, required: true
  attr :active, :boolean, default: false
  attr :destructive, :boolean, default: false
  attr :rest, :global, include: ~w(href method navigate patch)

  def nav_menu_item(assigns) do
    ~H"""
    <li aria-current={@active and "page"} class="group flex-1">
      <.link
        class={[
          "flex flex-col items-center justify-center gap-1 p-4",
          "bg-zk-surface/70 backdrop-blur-md",
          "text-center text-sm font-light transition-colors",
          "hover:bg-zk-secondary focus-visible:bg-zk-secondary focus-visible:outline-0",
          "md:group-first:rounded-l-full md:group-last:rounded-r-full",
          @active && "text-zk-primary-text",
          !@active && !@destructive && "text-zk-secondary-foreground",
          @destructive && "text-zk-destructive-text"
        ]}
        {@rest}
      >
        <.icon name={@icon} />
        {@label}
      </.link>
    </li>
    """
  end

  @doc """
  Tab bar component.

  Renders a tab bar fixed to the bottom of the screen.
  It can be used in combination with the `ZoonkWeb.Components.Layout.nav_menu_item/1` component.
  """
  slot :inner_block, required: true

  def tab_bar(assigns) do
    ~H"""
    <nav
      aria-label={gettext("Main menu")}
      class={[
        "fixed bottom-0 z-10 flex w-full justify-around",
        "border-zk-border border-t",
        "md:left-1/2 md:-translate-x-1/2",
        "md:bottom-4 md:rounded-full",
        "md:max-w-md md:border-t-0",
        "md:shadow-lg"
      ]}
    >
      <ul class="flex w-full">
        {render_slot(@inner_block)}
      </ul>
    </nav>
    """
  end
end
