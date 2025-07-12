defmodule ZoonkDev.UIPreview.TogglePreviewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkDev.UIPreview.UIPreviewLayout.render active_page={:toggle} page_title={@page_title}>
      <.card>
        <.card_header>
          <.card_title>Toggle Without Icon</.card_title>
          <.card_description>Default toggle without icons</.card_description>
        </.card_header>

        <.card_content align={:bottom} class="flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <.text size={:sm} variant={:secondary}>Default</.text>
            <.toggle_group class="w-full">
              <.toggle_item value="1" name="toggle-default">
                Default 1
              </.toggle_item>

              <.toggle_item value="2" name="toggle-default">
                Default 2
              </.toggle_item>

              <.toggle_item value="3" name="toggle-default">
                Default 3
              </.toggle_item>
            </.toggle_group>
          </div>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Toggle With Icons</.card_title>
          <.card_description>Toggle items can include icons.</.card_description>
        </.card_header>

        <.card_content align={:bottom} class="flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <.text size={:sm} variant={:secondary}>View Mode</.text>
            <.toggle_group>
              <.toggle_item value="list" icon="tabler-list" name="view-mode">
                List
              </.toggle_item>

              <.toggle_item value="grid" icon="tabler-grid-dots" name="view-mode">
                Grid
              </.toggle_item>

              <.toggle_item value="kanban" icon="tabler-layout-kanban" name="view-mode">
                Kanban
              </.toggle_item>
            </.toggle_group>
          </div>

          <div class="flex flex-col gap-2">
            <.text size={:sm} variant={:secondary}>Icon Only</.text>

            <.toggle_group>
              <.toggle_item value="bold" icon="tabler-bold" name="icon-only">
                <span class="sr-only">Bold</span>
              </.toggle_item>

              <.toggle_item value="italic" icon="tabler-italic" name="icon-only">
                <span class="sr-only">Italic</span>
              </.toggle_item>

              <.toggle_item value="underline" icon="tabler-underline" name="icon-only">
                <span class="sr-only">Underline</span>
              </.toggle_item>

              <.toggle_item value="strikethrough" icon="tabler-strikethrough" name="icon-only">
                <span class="sr-only">Strikethrough</span>
              </.toggle_item>
            </.toggle_group>
          </div>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Interactive Examples</.card_title>
          <.card_description>Toggle groups that respond to user interaction.</.card_description>
        </.card_header>

        <.card_content align={:bottom} class="flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <.text size={:sm} variant={:secondary}>Theme: {@interactive_theme}</.text>
            <.toggle_group phx-change="change_theme">
              <.toggle_item
                value="light"
                icon="tabler-sun"
                name="interactive-theme"
                checked={@interactive_theme == "light"}
              >
                Light
              </.toggle_item>

              <.toggle_item
                value="dark"
                icon="tabler-moon"
                name="interactive-theme"
                checked={@interactive_theme == "dark"}
              >
                Dark
              </.toggle_item>

              <.toggle_item
                value="system"
                icon="tabler-device-desktop"
                name="interactive-theme"
                checked={@interactive_theme == "system"}
              >
                System
              </.toggle_item>
            </.toggle_group>
          </div>
        </.card_content>
      </.card>
    </ZoonkDev.UIPreview.UIPreviewLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket =
      socket
      |> assign(:page_title, "Toggle")
      |> assign(:interactive_theme, "system")

    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def handle_event("change_theme", %{"interactive-theme" => theme}, socket) do
    {:noreply, assign(socket, :interactive_theme, theme)}
  end
end
