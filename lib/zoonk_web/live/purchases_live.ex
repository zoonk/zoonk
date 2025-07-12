defmodule ZoonkWeb.PurchasesLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  on_mount {ZoonkWeb.UserAuthorization, :ensure_org_member}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.SettingsLayout.render flash={@flash} scope={@scope} current_page={:purchases}>
      purchases placeholder
    </ZoonkWeb.SettingsLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, dgettext("page_title", "Purchases"))
    {:ok, socket}
  end
end
