defmodule ZoonkWeb.Catalog.CatalogHomeLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <main>
      <nav class="flex items-center justify-between gap-4 p-4">
        <.a kind={:icon} icon="tabler-arrow-left" variant={:outline} navigate={~p"/"}>
          <span class="sr-only">{gettext("Back to app")}</span>
        </.a>

        <.a :if={!@scope.user} kind={:button} variant={:outline} href={~p"/login"}>
          {gettext("Login")}
        </.a>
      </nav>
    </main>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, dgettext("content", "Catalog"))
    {:ok, socket}
  end
end
