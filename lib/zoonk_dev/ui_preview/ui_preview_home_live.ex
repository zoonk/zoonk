defmodule ZoonkDev.UIPreview.UIPreviewHomeLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkDev.UIPreview.UIPreviewLayout.render
      active_page={:home}
      flash={@flash}
      page_title={@page_title}
    >
      <.card>
        <.card_header icon="tabler-palette-filled">
          <.card_title>UI Preview</.card_title>
          <.card_description>Test and experiment with UI components</.card_description>
        </.card_header>

        <.card_content>
          <.text>
            You can use this space to test different components and their configurations.
          </.text>
        </.card_content>
      </.card>
    </ZoonkDev.UIPreview.UIPreviewLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, "UI Preview")
    {:ok, socket}
  end
end
