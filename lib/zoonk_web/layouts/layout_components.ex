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
  attr :active, :boolean, default: false
  attr :destructive, :boolean, default: false
  attr :rest, :global, include: ~w(href method navigate patch)

  def nav_menu_item(assigns) do
    ~H"""
    <li aria-current={@active and "page"}>
      <.link {@rest}>
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
    <nav aria-label={gettext("Main menu")}>
      <ul>
        {render_slot(@inner_block)}
      </ul>
    </nav>
    """
  end
end
