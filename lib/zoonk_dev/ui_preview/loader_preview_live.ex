defmodule ZoonkDev.UIPreview.LoaderPreviewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkDev.UIPreview.UIPreviewLayout.render active_page={:loader} page_title="Loader">
      <.card>
        <.card_header>
          <.card_title>Default Loader</.card_title>
          <.card_description>
            A minimalist pulsing dot loader for subtle loading states.
          </.card_description>
        </.card_header>

        <.card_content class="flex flex-col gap-8">
          <.loader />
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Loader Sizes</.card_title>
          <.card_description>You can have multiple sizes.</.card_description>
        </.card_header>

        <.card_content class="flex gap-8">
          <.loader size={:xs} />
          <.loader size={:sm} />
          <.loader size={:md} />
          <.loader size={:lg} />
          <.loader size={:xl} />
        </.card_content>
      </.card>
    </ZoonkDev.UIPreview.UIPreviewLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    {:ok, assign(socket, :page_title, "Loader")}
  end
end
