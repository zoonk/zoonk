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

  attr :user, User, required: true, doc: "The user scope containing user information"

  @doc """
  Renders the main navigation bar.

  ## Examples

      <.navbar user={@user} />
  """
  def navbar(assigns) do
    ~H"""
    <nav class="flex items-center justify-between gap-2 p-4" aria-label={gettext("Main navigation")}>
      <.a
        kind={:button}
        icon="tabler-layout-grid"
        variant={:outline}
        navigate={~p"/catalog"}
        size={:adaptive}
      >
        {gettext("Catalog")}
      </.a>

      <.live_component module={ZoonkWeb.CommandPaletteLive} id="command-palette" />

      <.a
        kind={:button}
        icon="tabler-circle-plus"
        variant={:secondary}
        navigate={~p"/learn"}
        size={:adaptive}
        class="ml-auto"
      >
        {gettext("Start course")}
      </.a>

      <.dropdown label={dgettext("users", "Open settings menu")}>
        <.avatar
          src={@user.profile.picture_url}
          size={:sm}
          alt={User.get_display_name(@user.profile)}
        />

        <.dropdown_content>
          <.dropdown_item icon="tabler-layout-grid" navigate={~p"/my-courses"}>
            {dgettext("users", "My courses")}
          </.dropdown_item>

          <.dropdown_item icon="tabler-target" navigate={~p"/missions"}>
            {dgettext("users", "Missions")}
          </.dropdown_item>

          <.dropdown_separator />

          <.dropdown_item icon="tabler-package" navigate={~p"/purchases"}>
            {dgettext("users", "Purchases")}
          </.dropdown_item>

          <.dropdown_item icon="tabler-diamond" navigate={~p"/subscription"}>
            {dgettext("users", "Subscription")}
          </.dropdown_item>

          <.dropdown_separator />

          <.dropdown_item icon="tabler-language" navigate={~p"/language"}>
            {dgettext("users", "App language")}
          </.dropdown_item>

          <.dropdown_item icon="tabler-id-badge" navigate={~p"/name"}>
            {dgettext("users", "Display name")}
          </.dropdown_item>

          <.dropdown_item icon="tabler-mail" navigate={~p"/email"}>
            {dgettext("users", "Change email")}
          </.dropdown_item>

          <.dropdown_separator />

          <.dropdown_item icon="tabler-message-circle" navigate={~p"/feedback"}>
            {dgettext("users", "Send feedback")}
          </.dropdown_item>

          <.dropdown_item icon="tabler-lifebuoy" navigate={~p"/support"}>
            {dgettext("users", "Support")}
          </.dropdown_item>

          <.dropdown_item icon="tabler-ufo" navigate={~p"/follow"}>
            {dgettext("users", "Follow us")}
          </.dropdown_item>

          <.dropdown_separator />

          <.dropdown_item icon="tabler-logout" method="delete" href={~p"/logout"}>
            {dgettext("users", "Logout")}
          </.dropdown_item>
        </.dropdown_content>
      </.dropdown>
    </nav>
    """
  end
end
