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
end
