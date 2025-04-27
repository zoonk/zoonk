defmodule ZoonkWeb.Catalog.CatalogHomeLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <main>
      <.a :if={!@scope.user} kind={:button} variant={:outline} href={~p"/login"}>
        {gettext("Login")}
      </.a>
    </main>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, dgettext("content", "Catalog"))
    {:ok, socket}
  end
end
