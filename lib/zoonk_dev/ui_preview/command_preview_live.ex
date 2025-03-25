defmodule ZoonkDev.UIPreview.CommandPreviewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Helpers

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkDev.UIPreview.UIPreviewLayout.render active_page={:command} page_title={@page_title}>
      <.card>
        <.card_header>
          <.card_title>Command Trigger</.card_title>

          <.card_description>
            A command menu component that triggers a dialog when clicked.
            It also responds to keyboard shortcuts (Cmd+K or Ctrl+K).
          </.card_description>
        </.card_header>

        <.card_content align={:center} class="flex flex-col gap-4">
          <.command_trigger
            id="docs-trigger"
            label="Search documentation..."
            dialog_id="search-dialog"
          />
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Custom Command Trigger</.card_title>

          <.card_description>
            Command menus can be customized with different labels and keyboard shortcuts.
          </.card_description>
        </.card_header>

        <.card_content align={:bottom} class="flex flex-col gap-4">
          <.command_trigger
            id="settings-trigger"
            label="Find settings..."
            dialog_id="settings-dialog"
            shortcut="p"
          />
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Command Groups</.card_title>

          <.card_description>
            Command menus can organize items into groups with headings and separators.
          </.card_description>
        </.card_header>

        <.card_content align={:bottom} class="flex flex-col gap-4">
          <.command_trigger
            id="groups-trigger"
            label="Open grouped menu..."
            dialog_id="groups-dialog"
            shortcut="g"
          />
        </.card_content>
      </.card>

      <.dialog id="search-dialog">
        <.command_input placeholder="Type to search..." />

        <.command_list>
          <.command_item :for={i <- 1..5}>
            <.icon name="tabler-file-text" />
            <span>Documentation item {i}</span>
          </.command_item>
        </.command_list>
      </.dialog>

      <.dialog id="settings-dialog">
        <form phx-change="search" phx-submit="search">
          <.command_input placeholder="Search settings..." icon="tabler-settings" />
        </form>

        <.command_list>
          <.command_item :for={item <- @results}>
            <.icon name={item.icon} />
            <span>{item.label}</span>
            <.command_shortcut>{item.shortcut}</.command_shortcut>
          </.command_item>
        </.command_list>
      </.dialog>

      <.dialog id="groups-dialog">
        <.command_input placeholder="Search commands..." />

        <.command_list>
          <.command_group heading="Suggestions">
            <.command_item>
              <.icon name="tabler-calendar" />
              <span>Calendar</span>
            </.command_item>

            <.command_item>
              <.icon name="tabler-mood-happy" />
              <span>Search Emoji</span>
            </.command_item>

            <.command_item>
              <.icon name="tabler-calculator" />
              <span>Calculator</span>
            </.command_item>
          </.command_group>

          <.command_separator />

          <.command_group heading="Settings">
            <.command_item :for={item <- settings()}>
              <.icon name={item.icon} />
              <span>{item.label}</span>
              <.command_shortcut>{item.shortcut}</.command_shortcut>
            </.command_item>
          </.command_group>
        </.command_list>
      </.dialog>
    </ZoonkDev.UIPreview.UIPreviewLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket =
      socket
      |> assign(page_title: "Command")
      |> assign(results: settings())

    {:ok, socket}
  end

  def settings,
    do: [
      %{icon: "tabler-user", label: "Account settings", shortcut: "⌘A"},
      %{icon: "tabler-bell", label: "Notifications", shortcut: "⌘N"},
      %{icon: "tabler-palette", label: "Appearance", shortcut: "⌘T"},
      %{icon: "tabler-shield", label: "Privacy & Security", shortcut: "⌘P"},
      %{icon: "tabler-language", label: "Language", shortcut: "⌘L"}
    ]

  @impl Phoenix.LiveView
  def handle_event("search", %{"query" => query}, socket) do
    results = Helpers.fuzzy_search(settings(), query, & &1.label)
    {:noreply, assign(socket, results: results)}
  end
end
