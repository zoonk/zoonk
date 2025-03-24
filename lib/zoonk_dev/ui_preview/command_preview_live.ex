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

        <.card_content align={:center} class="flex flex-col gap-4">
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
          <li :for={i <- 1..5} class="group">
            <button class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-zk-secondary-accent">
              <.icon name="tabler-file-text" class="size-4 text-zk-muted-foreground" />
              <span>Documentation item {i}</span>
            </button>
          </li>
        </.command_list>
      </.dialog>

      <.dialog id="settings-dialog">
        <.command_input placeholder="Search settings..." icon="tabler-settings" />
        <.command_list>
          <li
            :for={
              {icon, label} <- [
                {"tabler-user", "Account settings"},
                {"tabler-bell", "Notifications"},
                {"tabler-palette", "Appearance"},
                {"tabler-shield", "Privacy & Security"},
                {"tabler-language", "Language"}
              ]
            }
            class="group"
          >
            <button class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-zk-secondary-accent">
              <.icon name={icon} class="size-4 text-zk-muted-foreground" />
              <span>{label}</span>
            </button>
          </li>
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
end
