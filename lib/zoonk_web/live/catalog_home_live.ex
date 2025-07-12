defmodule ZoonkWeb.CatalogLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  on_mount {ZoonkWeb.UserAuth, :ensure_auth_for_private_orgs}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render flash={@flash} scope={@scope} page={:catalog}>
      catalog placeholder
    </ZoonkWeb.AppLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, dgettext("page_title", "Catalog"))
    {:ok, socket}
  end
end
