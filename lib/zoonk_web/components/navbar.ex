defmodule ZoonkWeb.Components.Navbar do
  @moduledoc """
  Navbar component for the main application navigation.
  """
  use Phoenix.Component
  use ZoonkWeb, :verified_routes

  import ZoonkWeb.Components.Anchor
  import ZoonkWeb.Components.Avatar
  import ZoonkWeb.Components.Dropdown

  alias Zoonk.Accounts.User

  attr :user, User, doc: "The user scope containing user information"

  @doc """
  Renders the main navigation bar.

  ## Examples

      <.navbar user={@user} />
  """
  def navbar(assigns) do
    ~H"""
    <nav
      class="flex items-center justify-between gap-2"
      aria-label={dgettext("menu", "Main navigation")}
    >
      <.a :if={@user} kind={:icon} icon="tabler-home" variant={:outline} navigate={~p"/"} size={:sm}>
        {dgettext("menu", "Home page")}
      </.a>

      <.a
        kind={:button}
        icon="tabler-layout-grid"
        variant={:outline}
        navigate={~p"/catalog"}
        size={:adaptive}
      >
        {dgettext("menu", "Catalog")}
      </.a>

      <.live_component
        module={ZoonkWeb.CommandPaletteLive}
        authenticated={@user != nil}
        id="command-palette"
      />

      <.a
        :if={@user}
        kind={:button}
        icon="tabler-circle-plus"
        variant={:secondary}
        navigate={~p"/learn"}
        size={:adaptive}
        class="ml-auto"
      >
        {dgettext("menu", "Start course")}
      </.a>

      <.a
        :if={is_nil(@user)}
        kind={:button}
        variant={:outline}
        navigate={~p"/login"}
        size={:sm}
        class="ml-auto"
      >
        {dgettext("menu", "Login")}
      </.a>

      <.a :if={is_nil(@user)} kind={:button} navigate={~p"/signup"} size={:sm}>
        {dgettext("menu", "Sign up")}
      </.a>

      <.dropdown :if={@user} label={dgettext("menu", "Open settings menu")}>
        <.avatar
          src={@user.profile.picture_url}
          size={:sm}
          alt={User.get_display_name(@user.profile)}
        />

        <.dropdown_content>
          <.dropdown_item icon="tabler-layout-grid" navigate={~p"/my-courses"}>
            {dgettext("menu", "My courses")}
          </.dropdown_item>

          <.dropdown_item icon="tabler-target" navigate={~p"/missions"}>
            {dgettext("menu", "Missions")}
          </.dropdown_item>

          <.dropdown_separator />

          <.dropdown_item icon="tabler-package" navigate={~p"/purchases"}>
            {dgettext("menu", "Purchases")}
          </.dropdown_item>

          <.dropdown_item icon="tabler-diamond" navigate={~p"/subscription"}>
            {dgettext("menu", "Subscription")}
          </.dropdown_item>

          <.dropdown_separator />

          <.dropdown_item icon="tabler-language" navigate={~p"/language"}>
            {dgettext("menu", "App language")}
          </.dropdown_item>

          <.dropdown_item icon="tabler-id-badge" navigate={~p"/name"}>
            {dgettext("menu", "Display name")}
          </.dropdown_item>

          <.dropdown_item icon="tabler-mail" navigate={~p"/email"}>
            {dgettext("menu", "Change email")}
          </.dropdown_item>

          <.dropdown_separator />

          <.dropdown_item icon="tabler-message-circle" navigate={~p"/feedback"}>
            {dgettext("menu", "Send feedback")}
          </.dropdown_item>

          <.dropdown_item icon="tabler-lifebuoy" navigate={~p"/support"}>
            {dgettext("menu", "Support")}
          </.dropdown_item>

          <.dropdown_item icon="tabler-ufo" navigate={~p"/follow"}>
            {dgettext("menu", "Follow us")}
          </.dropdown_item>

          <.dropdown_separator />

          <.dropdown_item icon="tabler-logout" method="delete" href={~p"/logout"}>
            {dgettext("menu", "Logout")}
          </.dropdown_item>
        </.dropdown_content>
      </.dropdown>
    </nav>
    """
  end
end
