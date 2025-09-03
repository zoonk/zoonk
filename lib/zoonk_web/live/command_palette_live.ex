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

  alias Zoonk.Accounts.User
  alias Zoonk.FuzzySearch
  alias Zoonk.Orgs.Org
  alias Zoonk.Scope

  attr :id, :string, required: true, doc: "The unique identifier for the component instance"
  attr :scope, Scope, required: true, doc: "Scope for the current user"
  attr :variant, :atom, values: [:icon, :input], default: :icon, doc: "The variant of the command trigger"

  @impl Phoenix.LiveComponent
  def render(assigns) do
    ~H"""
    <div class={[@variant == :input && "w-full", "mr-auto"]}>
      <.command_trigger
        variant={@variant}
        label={dgettext("menu", "Search...")}
        dialog_id={"command-palette-#{@id}"}
        phx-target={@myself}
      />

      <.dialog id={"command-palette-#{@id}"}>
        <form phx-change="search" phx-submit="search" phx-target={@myself}>
          <.command_input label={dgettext("menu", "Search pages...")} />
        </form>

        <.command_list>
          <.command_empty :if={empty?(@query, @scope)}>
            {dgettext("menu", "No pages found.")}
          </.command_empty>

          <.command_group
            :if={results(:navigation, @query, @scope) != []}
            heading={dgettext("menu", "Navigation")}
          >
            <.command_item
              :for={item <- results(:navigation, @query, @scope)}
              {build_nav_attrs(item)}
            >
              <.icon name={item.icon} class="size-4" />
              {item.label}
            </.command_item>
          </.command_group>

          <.command_group
            :if={results(:settings, @query, @scope) != []}
            heading={dgettext("menu", "Settings")}
          >
            <.command_item :for={item <- results(:settings, @query, @scope)} {build_nav_attrs(item)}>
              <.icon name={item.icon} class="size-4" />
              {item.label}
            </.command_item>
          </.command_group>

          <.command_group
            :if={results(:support, @query, @scope) != []}
            heading={dgettext("menu", "Support")}
          >
            <.command_item
              :for={item <- results(:support, @query, @scope)}
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

  defp visible?(:always, _scope), do: true
  defp visible?(:authenticated, %Scope{user: %User{}}), do: true
  defp visible?(:unauthenticated, %Scope{user: nil}), do: true
  defp visible?(:catalog, %Scope{org: %Org{kind: :system}}), do: true
  defp visible?(:system, %Scope{org: %Org{kind: :system}}), do: true
  defp visible?(_visibility, _scope), do: false

  defp empty?(query, scope) do
    started_typing?(query) and not results?(query, scope)
  end

  defp started_typing?(query) do
    query
    |> String.trim()
    |> Kernel.!=("")
  end

  defp results?(query, scope) do
    Enum.any?(sections(), fn section ->
      results(section, query, scope) != []
    end)
  end

  defp results(:navigation), do: navigation_items()
  defp results(:settings), do: settings_items()
  defp results(:support), do: support_items()

  defp results(section, query, scope) do
    section
    |> results()
    |> maybe_search_results(query)
    |> filter_results(scope)
  end

  defp maybe_search_results(items, ""), do: items
  defp maybe_search_results(items, query), do: FuzzySearch.search(items, query, & &1.label)

  defp filter_results(items, scope), do: Enum.filter(items, &visible?(&1.visibility, scope))

  defp sections do
    [:navigation, :settings, :support]
  end
end
