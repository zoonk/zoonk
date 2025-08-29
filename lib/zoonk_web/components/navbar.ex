defmodule ZoonkWeb.Components.Navbar do
  @moduledoc """
  Navbar component for the main application navigation.
  """
  use Phoenix.Component
  use ZoonkWeb, :verified_routes

  import ZoonkWeb.Components.Anchor
  import ZoonkWeb.Components.Avatar
  import ZoonkWeb.Components.Dropdown
  import ZoonkWeb.MenuIcon

  alias Zoonk.Accounts.User
  alias Zoonk.Scope

  attr :scope, Scope, doc: "The scope for current user"

  attr :page, :atom,
    values: [:home, :catalog, :start_course, :other],
    default: :other,
    doc: "The current page"

  @doc """
  Renders the main navigation bar.

  ## Examples

      <.navbar scope={@scope} page={:home} />
  """
  def navbar(assigns) do
    ~H"""
    <nav
      class="flex items-center justify-between gap-2"
      aria-label={dgettext("menu", "Main navigation")}
    >
      <.a
        :if={@scope.user}
        kind={:icon}
        icon={menu_icon(:home)}
        variant={variant(:home, @page)}
        navigate={~p"/"}
        size={:sm}
      >
        {dgettext("menu", "Home page")}
      </.a>

      <.a
        kind={:button}
        icon={menu_icon(:catalog)}
        variant={variant(:catalog, @page)}
        navigate={~p"/catalog"}
        size={:adaptive}
      >
        {dgettext("menu", "Catalog")}
      </.a>

      <.live_component
        module={ZoonkWeb.CommandPaletteLive}
        scope={@scope}
        id="command-palette"
      />

      <.a
        :if={@scope.user && @scope.org.kind == :system}
        kind={:button}
        icon={menu_icon(:new_course)}
        variant={variant(:start_course, @page)}
        navigate={~p"/learn"}
        size={:adaptive}
        class="ml-auto"
      >
        {dgettext("menu", "Start course")}
      </.a>

      <.a
        :if={is_nil(@scope.user)}
        kind={:button}
        variant={:outline}
        navigate={~p"/login"}
        size={:sm}
        class="ml-auto"
      >
        {dgettext("menu", "Login")}
      </.a>

      <.a :if={is_nil(@scope.user)} kind={:button} navigate={~p"/signup"} size={:sm}>
        {dgettext("menu", "Sign up")}
      </.a>

      <.dropdown :if={@scope.user} label={dgettext("menu", "Open settings menu")}>
        <.avatar
          src={@scope.user.profile.picture_url}
          size={:sm}
          alt={User.get_display_name(@scope.user.profile)}
        />

        <.dropdown_content>
          <.dropdown_item icon={menu_icon(:my_courses)} navigate={~p"/my-courses"}>
            {dgettext("menu", "My courses")}
          </.dropdown_item>

          <.dropdown_separator />

          <.dropdown_item icon={menu_icon(:subscription)} navigate={~p"/subscription"}>
            {dgettext("menu", "Subscription")}
          </.dropdown_item>

          <.dropdown_item icon={menu_icon(:settings)} navigate={~p"/settings"}>
            {dgettext("menu", "Settings")}
          </.dropdown_item>

          <.dropdown_item icon={menu_icon(:contact)} navigate={~p"/contact"}>
            {dgettext("menu", "Contact us")}
          </.dropdown_item>

          <.dropdown_separator />

          <.dropdown_item icon={menu_icon(:logout)} method="delete" href={~p"/logout"}>
            {dgettext("menu", "Logout")}
          </.dropdown_item>
        </.dropdown_content>
      </.dropdown>
    </nav>
    """
  end

  defp variant(menu, page) when menu == page, do: :active
  defp variant(menu, _page) when menu == :start_course, do: :secondary
  defp variant(_menu, _page), do: :outline
end
