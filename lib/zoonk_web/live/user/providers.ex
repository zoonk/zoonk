defmodule ZoonkWeb.Live.UserProviders do
  @moduledoc false
  use ZoonkWeb, :live_view

  def render(assigns) do
    ~H"""
    <div>
      providers
    </div>
    """
  end

  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: dgettext("users", "Providers"))
    {:ok, socket, layout: {ZoonkWeb.Layouts, :user_settings}}
  end
end
