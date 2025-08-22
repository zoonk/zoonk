defmodule ZoonkWeb.UIPreview.FlashPreviewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.UIPreview.UIPreviewLayout.render active_page={:flash} page_title={@page_title}>
      <.card>
        <.card_header>
          <.card_title>Flash Types</.card_title>
          <.card_description>
            Flash messages can be of different types: info and error.
          </.card_description>
        </.card_header>

        <.card_content class="flex flex-col gap-4">
          <.flash kind={:info}>This is an information message</.flash>
          <.flash kind={:error}>This is an error message</.flash>
        </.card_content>
      </.card>
    </ZoonkWeb.UIPreview.UIPreviewLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Flash")
    {:ok, socket}
  end
end
