defmodule ZoonkDev.Live.UIDivider do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <article class="flex flex-col gap-4">
      <.divider label="Or continue with" />
    </article>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Divider")
    {:ok, socket}
  end
end
