defmodule ZoonkDev.UIPreview.PillPreviewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkDev.UIPreview.UIPreviewLayout.render active_page={:pill} page_title={@page_title}>
      <.card>
        <.card_header>
          <.card_title>Basic Pills</.card_title>
          <.card_description>
            Pills are used for navigation and can show active/inactive states.
          </.card_description>
        </.card_header>

        <.card_content>
          <ul class="flex gap-2 overflow-x-auto py-4">
            <.pill icon="tabler-home" active>
              Home
            </.pill>

            <.pill icon="tabler-settings" color="text-blue-500">
              Settings
            </.pill>

            <.pill icon="tabler-user" color="text-green-500">
              Profile
            </.pill>
          </ul>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Custom Styling</.card_title>
          <.card_description>
            Pills can accept additional CSS classes for custom styling.
          </.card_description>
        </.card_header>

        <.card_content>
          <ul class="flex gap-2 overflow-x-auto py-4">
            <.pill icon="tabler-star" color="text-yellow-500" class="border-2 border-yellow-300">
              With Border
            </.pill>

            <.pill icon="tabler-heart" color="text-red-500" class="bg-red-50">
              Custom Background
            </.pill>
          </ul>
        </.card_content>
      </.card>
    </ZoonkDev.UIPreview.UIPreviewLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Pill")
    {:ok, socket}
  end
end
