defmodule ZoonkDev.UIPreview.CommandPreviewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

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
        <.command_input placeholder="Search settings..." icon="tabler-settings" />
        <.command_list>
          <.command_item :for={{icon, label, shortcut} <- settings()}>
            <.icon name={icon} />
            <span>{label}</span>
            <.command_shortcut>{shortcut}</.command_shortcut>
          </.command_item>
        </.command_list>
      </.dialog>
    </ZoonkDev.UIPreview.UIPreviewLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Command")
    {:ok, socket}
  end

  def settings,
    do: [
      {"tabler-user", "Account settings", "⌘A"},
      {"tabler-bell", "Notifications", "⌘N"},
      {"tabler-palette", "Appearance", "⌘T"},
      {"tabler-shield", "Privacy & Security", "⌘P"},
      {"tabler-language", "Language", "⌘L"}
    ]
end
