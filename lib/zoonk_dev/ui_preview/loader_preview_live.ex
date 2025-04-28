defmodule ZoonkDev.UIPreview.LoaderPreviewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkDev.UIPreview.UIPreviewLayout.render active_page={:loader} page_title="Loader">
      <.card>
        <.card_header>
          <.text tag="h2" size={:lg}>Default Loader</.text>
          <.text size={:sm} variant={:secondary}>
            A minimalist pulsing dot loader for subtle loading states.
          </.text>
        </.card_header>

        <.card_content class="flex flex-col gap-8">
          <.loader />
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.text tag="h2" size={:lg}>Loader Sizes</.text>
          <.text size={:sm} variant={:secondary}>
            You can have multiple sizes.
          </.text>
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
