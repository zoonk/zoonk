defmodule ZoonkWeb.AppHomeLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  on_mount {__MODULE__, :ensure_authenticated}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render flash={@flash} scope={@scope} page={:home}>
      home placeholder
    </ZoonkWeb.AppLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, dgettext("page_title", "Summary"))
    {:ok, socket}
  end

  def on_mount(:ensure_authenticated, _params, _session, socket) do
    if is_nil(socket.assigns.scope) or is_nil(socket.assigns.scope.user) do
      {:halt, Phoenix.LiveView.redirect(socket, to: ~p"/catalog")}
    else
      {:cont, socket}
    end
  end
end
