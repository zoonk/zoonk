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
        <form phx-change="search-docs" phx-submit="search-docs">
          <.command_input placeholder="Type to search..." />
        </form>

        <.command_list>
          <.command_item :for={item <- @doc_results}>
            <.icon name="tabler-file-text" />
            <span>{item.label}</span>
          </.command_item>
        </.command_list>
      </.dialog>

      <.dialog id="settings-dialog">
        <form phx-change="search-settings" phx-submit="search-settings">
          <.command_input placeholder="Search settings..." icon="tabler-settings" />
        </form>

        <.command_list>
          <.command_item :for={item <- @settings_results}>
            <.icon name={item.icon} />
            <span>{item.label}</span>
            <.command_shortcut>{item.shortcut}</.command_shortcut>
          </.command_item>
        </.command_list>
      </.dialog>

      <.dialog id="groups-dialog">
        <form phx-change="search-groups" phx-submit="search-groups">
          <.command_input placeholder="Search commands..." />
        </form>

        <.command_list>
          <.command_group :if={show_suggestions?(@suggestions_results)} heading="Suggestions">
            <.command_item :for={item <- @suggestions_results}>
              <.icon name={item.icon} />
              <span>{item.label}</span>
            </.command_item>
          </.command_group>

          <.command_separator :if={
            show_suggestions?(@suggestions_results) and show_settings?(@groups_settings_results)
          } />

          <.command_group :if={show_settings?(@groups_settings_results)} heading="Settings">
            <.command_item :for={item <- @groups_settings_results}>
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
      |> assign(doc_results: documentation_items())
      |> assign(settings_results: settings())
      |> assign(suggestions_results: suggestions())
      |> assign(groups_settings_results: settings())

    {:ok, socket}
  end

  def documentation_items do
    [
      %{icon: "tabler-file-text", label: "Getting Started Guide"},
      %{icon: "tabler-file-text", label: "Installation Tutorial"},
      %{icon: "tabler-file-text", label: "API Reference"},
      %{icon: "tabler-file-text", label: "Component Examples"},
      %{icon: "tabler-file-text", label: "Best Practices"}
    ]
  end

  def settings do
    [
      %{icon: "tabler-user", label: "Account settings", shortcut: "⌘A"},
      %{icon: "tabler-bell", label: "Notifications", shortcut: "⌘N"},
      %{icon: "tabler-palette", label: "Appearance", shortcut: "⌘T"},
      %{icon: "tabler-shield", label: "Privacy & Security", shortcut: "⌘P"},
      %{icon: "tabler-language", label: "Language", shortcut: "⌘L"}
    ]
  end

  def suggestions do
    [
      %{icon: "tabler-calendar", label: "Calendar"},
      %{icon: "tabler-mood-happy", label: "Search Emoji"},
      %{icon: "tabler-calculator", label: "Calculator"}
    ]
  end

  defp show_suggestions?([]), do: false
  defp show_suggestions?(_items), do: true

  defp show_settings?([]), do: false
  defp show_settings?(_items), do: true

  @impl Phoenix.LiveView
  def handle_event("search-docs", %{"query" => query}, socket) do
    results = Helpers.fuzzy_search(documentation_items(), query, & &1.label)
    {:noreply, assign(socket, doc_results: results)}
  end

  def handle_event("search-settings", %{"query" => query}, socket) do
    results = Helpers.fuzzy_search(settings(), query, & &1.label)
    {:noreply, assign(socket, settings_results: results)}
  end

  def handle_event("search-groups", %{"query" => query}, socket) do
    suggestions_results = Helpers.fuzzy_search(suggestions(), query, & &1.label)
    groups_settings_results = Helpers.fuzzy_search(settings(), query, & &1.label)

    {:noreply,
     assign(socket,
       suggestions_results: suggestions_results,
       groups_settings_results: groups_settings_results
     )}
  end
end
