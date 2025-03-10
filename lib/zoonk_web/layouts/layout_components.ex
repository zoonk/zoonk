defmodule ZoonkWeb.Components.Layout do
  @moduledoc """
  Shared components for the `ZoonkWeb.Layouts` module.
  """
  use ZoonkWeb, :html

  @doc """
  Navigation menu item.

  Renders a menu item to be displayed at the bottom of the page.
  """
  attr :label, :string, required: true
  attr :icon, :string, required: true
  attr :href, :string, required: true
  attr :active, :boolean, default: false

  def nav_menu_item(assigns) do
    ~H"""
    <li aria-current={@active and "page"} class="group flex-1">
      <.link
        navigate={@href}
        class={[
          "flex flex-col items-center justify-center gap-1 p-4",
          "text-center text-sm font-medium",
          "zk-surface",
          "md:group-first:rounded-l-4xl md:group-last:rounded-r-4xl",
          @active and "text-zk-primary dark:text-zk-primary-300",
          !@active and "text-zk-text-secondary dark:text-zk-text-inverse-secondary",
          !@active and "contrast-more:text-zk-text-contrast"
        ]}
      >
        <.icon name={@icon} class="h-6 w-6" />
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
        "zk-surface fixed bottom-0 flex w-full justify-around",
        "zk-border border-t",
        "backdrop-blur-3xl",
        "md:left-1/2 md:-translate-x-1/2",
        "md:rounded-4xl md:bottom-4",
        "md:max-w-md md:border-t-0",
        "md:shadow-sm"
      ]}
    >
      <ul class="flex w-full">
        {render_slot(@inner_block)}
      </ul>
    </nav>
    """
  end
end
