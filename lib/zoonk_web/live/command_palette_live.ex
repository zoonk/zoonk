defmodule ZoonkWeb.CommandPaletteLive do
  @moduledoc """
  Command palette LiveComponent for quick navigation and search functionality.

  Provides a searchable command interface accessible via keyboard shortcuts
  or button trigger. Includes navigation links and actions.
  """
  use ZoonkWeb, :live_component
  use ZoonkWeb, :verified_routes

  import ZoonkWeb.CommandPaletteConfig
  import ZoonkWeb.Components.Command
  import ZoonkWeb.Components.Dialog
  import ZoonkWeb.Components.Icon

  alias Zoonk.FuzzySearch

  @impl Phoenix.LiveComponent
  def render(assigns) do
    ~H"""
    <div>
      <.command_trigger
        variant={:icon}
        label={dgettext("menu", "Open command palette")}
        dialog_id={"command-palette-#{@id}"}
        phx-target={@myself}
      />

      <.dialog id={"command-palette-#{@id}"}>
        <form phx-change="search" phx-submit="search" phx-target={@myself}>
          <.command_input placeholder={dgettext("menu", "Search commands...")} />
        </form>

        <.command_list>
          <.command_empty :if={@query != "" and @search_results == []}>
            {dgettext("menu", "No commands found.")}
          </.command_empty>
          
    <!-- Search results (flat list when searching) -->
          <div :if={@query != "" and @search_results != []}>
            <.command_item :for={item <- @search_results} {build_nav_attrs(item)}>
              <.icon name={item.icon} class="size-4" />
              {item.label}
            </.command_item>
          </div>
          
    <!-- Categorized view (when not searching) -->
          <div :if={@query == ""}>
            <.command_group heading={dgettext("menu", "Navigation")}>
              <.command_item :for={item <- navigation_items()} {build_nav_attrs(item)}>
                <.icon name={item.icon} class="size-4" />
                {item.label}
              </.command_item>
            </.command_group>

            <.command_separator />

            <.command_group heading={dgettext("menu", "My Account")}>
              <.command_item :for={item <- user_items()} {build_nav_attrs(item)}>
                <.icon name={item.icon} class="size-4" />
                {item.label}
              </.command_item>
            </.command_group>

            <.command_separator />

            <.command_group heading={dgettext("menu", "Settings")}>
              <.command_item :for={item <- settings_items()} {build_nav_attrs(item)}>
                <.icon name={item.icon} class="size-4" />
                {item.label}
              </.command_item>
            </.command_group>

            <.command_separator />

            <.command_group heading={dgettext("menu", "Support")}>
              <.command_item
                :for={item <- support_items()}
                :if={visible?(item.visibility, @authenticated)}
                {build_nav_attrs(item)}
              >
                <.icon name={item.icon} class="size-4" />
                {item.label}
              </.command_item>
            </.command_group>
          </div>
        </.command_list>
      </.dialog>
    </div>
    """
  end

  @impl Phoenix.LiveComponent
  def mount(socket) do
    socket =
      socket
      |> assign(query: "")
      |> assign(search_results: [])

    {:ok, socket}
  end

  @impl Phoenix.LiveComponent
  def handle_event("search", %{"query" => query}, socket) do
    socket = assign(socket, :query, query)

    case String.trim(query) do
      "" -> {:noreply, assign(socket, search_results: [])}
      trimmed_query -> {:noreply, assign_search_results(socket, trimmed_query)}
    end
  end

  defp build_nav_attrs(item) do
    []
    |> maybe_add_attr(:navigate, item[:navigate])
    |> maybe_add_attr(:href, item[:href])
    |> maybe_add_attr(:method, item[:method])
  end

  defp maybe_add_attr(attrs, _key, nil), do: attrs
  defp maybe_add_attr(attrs, key, value), do: [{key, value} | attrs]

  defp assign_search_results(socket, query) do
    search_results = FuzzySearch.search(all_items(), query, & &1.label)
    assign(socket, search_results: search_results)
  end

  defp visible?(:always, _status), do: true
  defp visible?(:authenticated, true), do: true
  defp visible?(:unauthenticated, false), do: true
  defp visible?(_visibility, _status), do: false
end
