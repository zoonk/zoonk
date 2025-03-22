defmodule ZoonkDev.Live.UICard do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <article class="flex flex-col gap-4">
      <.card>
        <.card_header icon="tabler-settings">
          <.card_title>Card title</.card_title>
          <.card_description>Card description</.card_description>
        </.card_header>

        <.card_content>
          <.text>Card with a header.</.text>
        </.card_content>
      </.card>

      <.card>
        <.card_content>
          <.text>Card without a header.</.text>
        </.card_content>
      </.card>
    </article>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Card")
    {:ok, socket}
  end
end
