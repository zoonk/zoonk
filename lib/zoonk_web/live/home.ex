defmodule ZoonkWeb.Live.Home do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <div>
      placeholder
    </div>
    """
  end
end
