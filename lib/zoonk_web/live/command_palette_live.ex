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
            {dgettext("menu", "No commands found.")}
          </.command_empty>

          <.command_group
            :if={navigation_results(@query, @scope) != []}
            heading={dgettext("menu", "Navigation")}
          >
            <.command_item
              :for={item <- navigation_results(@query, @scope)}
              {build_nav_attrs(item)}
            >
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

          <.command_group
            :if={support_results(@query, @scope) != []}
            heading={dgettext("menu", "Support")}
          >
            <.command_item
              :for={item <- support_results(@query, @scope)}
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
    query != "" &&
      navigation_results(query, scope) == [] &&
      settings_results(query) == [] &&
      support_results(query, scope) == []
  end

  defp navigation_results("", scope) do
    Enum.filter(navigation_items(), &visible?(&1.visibility, scope))
  end

  defp navigation_results(query, scope) do
    ""
    |> navigation_results(scope)
    |> FuzzySearch.search(query, & &1.label)
  end

  defp settings_results(""), do: settings_items()
  defp settings_results(query), do: FuzzySearch.search(settings_items(), query, & &1.label)

  defp support_results("", scope) do
    Enum.filter(support_items(), &visible?(&1.visibility, scope))
  end

  defp support_results(query, scope) do
    ""
    |> support_results(scope)
    |> FuzzySearch.search(query, & &1.label)
  end
end
