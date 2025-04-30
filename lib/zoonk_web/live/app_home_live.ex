defmodule ZoonkWeb.AppHomeLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Accounts.User

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <main>
      <nav class="flex items-center justify-between gap-4 p-4" aria-label={gettext("Main navigation")}>
        <.a
          kind={:button}
          icon="tabler-layout-grid"
          icon_on_mobile
          variant={:outline}
          navigate={~p"/catalog"}
        >
          {gettext("Catalog")}
        </.a>

        <.a
          kind={:button}
          icon="tabler-plus"
          icon_on_mobile
          variant={:outline}
          navigate={~p"/learn"}
          container_class="ml-auto"
        >
          {gettext("New course")}
        </.a>

        <.dropdown label={dgettext("users", "Open settings menu")}>
          <.avatar
            src={@scope.user.profile.picture_url}
            size={:md}
            alt={User.get_display_name(@scope.user.profile)}
          />

          <.dropdown_content>
            <.dropdown_item icon="tabler-mail" navigate={~p"/settings"}>
              {dgettext("users", "Change email")}
            </.dropdown_item>

            <.dropdown_item
              icon="tabler-logout"
              variant={:destructive}
              method="delete"
              href={~p"/logout"}
            >
              {dgettext("users", "Logout")}
            </.dropdown_item>
          </.dropdown_content>
        </.dropdown>

        <.link navigate={~p"/settings"}>
          <span class="sr-only">{gettext("Go to settings")}</span>
        </.link>
      </nav>
    </main>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, dgettext("content", "Summary"))
    {:ok, socket}
  end
end
