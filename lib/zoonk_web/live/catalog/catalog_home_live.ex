defmodule ZoonkWeb.Catalog.CatalogHomeLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <main>
      <nav
        class={[
          "flex items-center gap-4 p-4",
          @scope.user && "justify-between",
          !@scope.user && "justify-end"
        ]}
        aria-label={gettext("Actions")}
      >
        <.back_link :if={@scope.user} label={gettext("Home page")} navigate={~p"/"} />

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
