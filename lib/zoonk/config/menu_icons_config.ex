defmodule Zoonk.Config.MenuIconsConfig do
  @moduledoc """
  Configuration for menu icons used across the application.

  Centralizes icon definitions for navigation items to ensure consistency
  between the navbar, command palette, and other navigation components.
  """

  @icons %{
    # Navigation
    home: "home",
    catalog: "layout-grid",
    start_course: "circle-plus",

    # User Account
    my_courses: "layout-grid",
    missions: "target",
    purchases: "package",
    subscription: "diamond",

    # Settings
    language: "language",
    display_name: "id-badge",
    email: "mail",

    # Support
    feedback: "message-circle",
    support: "lifebuoy",
    follow: "ufo",
    logout: "logout"
  }

  @doc """
  Returns the icon name for a given menu action.

  ## Examples

      iex> Zoonk.Config.MenuIconsConfig.get_icon(:home)
      "tabler-home"

      iex> Zoonk.Config.MenuIconsConfig.get_icon(:catalog)
      "tabler-layout-grid"

      iex> Zoonk.Config.MenuIconsConfig.get_icon(:unknown)
      nil
  """
  def get_icon(action) when is_atom(action), do: get_icon(Map.get(@icons, action))
  def get_icon(icon) when is_binary(icon), do: "tabler-#{icon}"
  def get_icon(_icon), do: nil
end
