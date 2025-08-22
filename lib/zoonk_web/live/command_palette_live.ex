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
          <.command_empty :if={empty?(@query)}>
            {dgettext("menu", "No commands found.")}
          </.command_empty>

          <.command_group
            :if={navigation_results(@query) != []}
            heading={dgettext("menu", "Navigation")}
          >
            <.command_item :for={item <- navigation_results(@query)} {build_nav_attrs(item)}>
              <.icon name={item.icon} class="size-4" />
              {item.label}
            </.command_item>
          </.command_group>

          <.command_group :if={settings_results(@query) != []} heading={dgettext("menu", "Settings")}>
            <.command_item :for={item <- settings_results(@query)} {build_nav_attrs(item)}>
              <.icon name={item.icon} class="size-4" />
              {item.label}
            </.command_item>
          </.command_group>

          <.command_group :if={support_results(@query) != []} heading={dgettext("menu", "Support")}>
            <.command_item
              :for={item <- support_results(@query)}
              :if={visible?(item.visibility, @authenticated)}
              {build_nav_attrs(item)}
            >
              <.icon name={item.icon} class="size-4" />
              {item.label}
            </.command_item>
          </.command_group>
        </.command_list>
      </.dialog>
    </div>
    """
  end

  @impl Phoenix.LiveComponent
  def mount(socket) do
    {:ok, assign(socket, query: "")}
  end

  @impl Phoenix.LiveComponent
  def handle_event("search", %{"query" => query}, socket) do
    {:noreply, assign(socket, query: String.trim(query))}
  end

  defp build_nav_attrs(item) do
    []
    |> maybe_add_attr(:navigate, item[:navigate])
    |> maybe_add_attr(:href, item[:href])
    |> maybe_add_attr(:method, item[:method])
  end

  defp maybe_add_attr(attrs, _key, nil), do: attrs
  defp maybe_add_attr(attrs, key, value), do: [{key, value} | attrs]

  defp visible?(:always, _status), do: true
  defp visible?(:authenticated, true), do: true
  defp visible?(:unauthenticated, false), do: true
  defp visible?(_visibility, _status), do: false

  defp empty?(query) do
    query != "" && navigation_results(query) == [] && settings_results(query) == [] && support_results(query) == []
  end

  defp navigation_results(""), do: navigation_items()
  defp navigation_results(query), do: FuzzySearch.search(navigation_items(), query, & &1.label)

  defp settings_results(""), do: settings_items()
  defp settings_results(query), do: FuzzySearch.search(settings_items(), query, & &1.label)

  defp support_results(""), do: support_items()
  defp support_results(query), do: FuzzySearch.search(support_items(), query, & &1.label)
end
