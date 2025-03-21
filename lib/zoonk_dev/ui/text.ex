defmodule ZoonkDev.Live.UIText do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <article class="flex flex-col gap-4">
      <.text tag="h1" size={:header} variant={:primary}>Primary header</.text>
      <.text tag="h2" size={:title} variant={:secondary}>Secondary title</.text>
      <.text tag="h3" size={:subtitle} variant={:custom} class="text-zk-destructive font-extrabold">
        Custom subtitle
      </.text>
      <.text tag="p" size={:body} variant={:primary}>Primary body</.text>
      <.text tag="span" size={:caption} variant={:secondary}>Secondary caption</.text>
    </article>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Text")
    {:ok, socket}
  end
end
