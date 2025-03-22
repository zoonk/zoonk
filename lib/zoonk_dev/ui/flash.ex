defmodule ZoonkDev.Live.UIFlash do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <article class="flex flex-col gap-4">
      <.flash kind={:info} position={:none}>Add some message here</.flash>
      <.flash kind={:error} position={:none}>An error ocurred</.flash>
    </article>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Flash")
    {:ok, socket}
  end
end
