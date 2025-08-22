defmodule ZoonkWeb.MenuIcon do
  @moduledoc """
  A centralized module for menu icons.

  We use this to keep icons consistent throughout the application.
  """

  def menu_icon(:catalog), do: "tabler-layout-grid"
  def menu_icon(:close), do: "tabler-x"
  def menu_icon(:display_name), do: "tabler-id-badge"
  def menu_icon(:email), do: "tabler-mail"
  def menu_icon(:feedback), do: "tabler-message-circle"
  def menu_icon(:follow_us), do: "tabler-ufo"
  def menu_icon(:home), do: "tabler-home"
  def menu_icon(:interests), do: "tabler-heart"
  def menu_icon(:language), do: "tabler-language"
  def menu_icon(:login), do: "tabler-user"
  def menu_icon(:logout), do: "tabler-logout"
  def menu_icon(:my_courses), do: "tabler-layout-grid"
  def menu_icon(:new_course), do: "tabler-circle-plus"
  def menu_icon(:signup), do: "tabler-user-plus"
  def menu_icon(:subscription), do: "tabler-diamond"
  def menu_icon(:support), do: "tabler-lifebuoy"
end
