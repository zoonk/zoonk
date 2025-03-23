defmodule ZoonkDev.Live.UIFlash do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkDev.Layouts.UIPreview.render active_page={:flash} flash={@flash} page_title={@page_title}>
      <.card>
        <.card_header>
          <.card_title>Flash Types</.card_title>
          <.card_description>
            Flash messages can be of different types: info and error.
          </.card_description>
        </.card_header>

        <.card_content class="flex flex-col gap-4">
          <.flash kind={:info} position={:none}>This is an information message</.flash>
          <.flash kind={:error} position={:none}>This is an error message</.flash>
        </.card_content>
      </.card>
    </ZoonkDev.Layouts.UIPreview.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Flash")
    {:ok, socket}
  end
end
