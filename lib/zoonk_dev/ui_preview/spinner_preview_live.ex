defmodule ZoonkDev.UIPreview.SpinnerPreviewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkDev.UIPreview.UIPreviewLayout.render active_page={:spinner} page_title={@page_title}>
      <.card>
        <.card_header>
          <.text tag="h2" size={:lg}>Spinner Component</.text>
          <.text size={:sm} variant={:secondary}>
            A loading indicator that shows the system is processing something.
          </.text>
        </.card_header>

        <.card_content>
          <div class="flex flex-col gap-8">
            <div class="flex flex-col gap-4">
              <.text tag="h3" size={:md}>Default</.text>
              <div class="flex items-center gap-4">
                <.spinner />
              </div>
            </div>

            <div class="flex flex-col gap-4">
              <.text tag="h3" size={:md}>Sizes</.text>
              <div class="flex items-center gap-4">
                <div class="flex flex-col items-center gap-2">
                  <.spinner size={:xs} />
                  <.text size={:xs} variant={:secondary}>Extra Small</.text>
                </div>
                <div class="flex flex-col items-center gap-2">
                  <.spinner size={:sm} />
                  <.text size={:xs} variant={:secondary}>Small</.text>
                </div>
                <div class="flex flex-col items-center gap-2">
                  <.spinner size={:md} />
                  <.text size={:xs} variant={:secondary}>Medium</.text>
                </div>
                <div class="flex flex-col items-center gap-2">
                  <.spinner size={:lg} />
                  <.text size={:xs} variant={:secondary}>Large</.text>
                </div>
                <div class="flex flex-col items-center gap-2">
                  <.spinner size={:xl} />
                  <.text size={:xs} variant={:secondary}>Extra Large</.text>
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-4">
              <.text tag="h3" size={:md}>Colors</.text>
              <div class="flex items-center gap-4">
                <div class="flex flex-col items-center gap-2">
                  <.spinner variant={:primary} />
                  <.text size={:xs} variant={:secondary}>Primary</.text>
                </div>
                <div class="flex flex-col items-center gap-2">
                  <.spinner variant={:secondary} />
                  <.text size={:xs} variant={:secondary}>Secondary</.text>
                </div>
                <div class="flex flex-col items-center gap-2 bg-black p-4">
                  <.spinner variant={:white} />
                  <.text size={:xs} variant={:secondary}>White</.text>
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-4">
              <.text tag="h3" size={:md}>Usage Examples</.text>
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <.card size={:full}>
                  <.card_content class="flex items-center justify-center p-8">
                    <div class="flex items-center gap-3">
                      <.spinner />
                      <.text>Loading data...</.text>
                    </div>
                  </.card_content>
                </.card>

                <.card size={:full}>
                  <.card_content class="flex items-center justify-center p-8">
                    <.button disabled class="flex items-center gap-2">
                      <.spinner size={:xs} variant={:white} />
                      <span>Saving...</span>
                    </.button>
                  </.card_content>
                </.card>
              </div>
            </div>
          </div>
        </.card_content>
      </.card>
    </ZoonkDev.UIPreview.UIPreviewLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Spinner Component")
    {:ok, socket}
  end
end
