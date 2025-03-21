defmodule ZoonkDev.Live.UIText do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <article class="flex flex-col gap-4">
      <.text tag="h1" size={:header} variant={:primary}>Primary header</.text>
      <.text tag="h1" size={:header} variant={:secondary}>Secondary header</.text>

      <.text tag="h2" size={:title} variant={:primary}>Primary title</.text>
      <.text tag="h2" size={:title} variant={:secondary}>Secondary title</.text>

      <.text tag="h3" size={:subtitle} variant={:primary}>Primary subtitle</.text>
      <.text tag="h3" size={:subtitle} variant={:secondary}>Secondary subtitle</.text>

      <.text tag="p" size={:body} variant={:primary}>Primary body</.text>
      <.text tag="p" size={:body} variant={:secondary}>Secondary body</.text>

      <.text tag="p" size={:caption} variant={:primary}>Primary caption</.text>
      <.text tag="span" size={:caption} variant={:secondary}>Secondary caption</.text>

      <.text tag="label" size={:body} variant={:custom} class="text-pink-500">
        Custom text
      </.text>
    </article>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Text")
    {:ok, socket}
  end
end
