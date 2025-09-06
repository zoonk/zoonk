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
          <.command_empty>
            {dgettext("menu", "No pages found.")}
          </.command_empty>

          <.command_group
            heading={dgettext("menu", "Courses")}
            kind={:dynamic}
            id="command-group-courses"
          >
            <.command_item
              :for={item <- @courses}
              label={item.label}
              {build_nav_attrs(item)}
            >
              {item.label}
            </.command_item>
          </.command_group>

          <.command_group
            :for={section <- sections()}
            heading={section.title}
            id={"command-group-#{section.key}"}
          >
            <.command_item
              :for={item <- menu_items(section.key, @scope)}
              label={item.label}
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
    {:ok, assign(socket, courses: [])}
  end

  @impl Phoenix.LiveComponent
  def handle_event("search", %{"query" => query}, socket) do
    query = String.trim(query)
    {:noreply, assign(socket, courses: search_courses(query))}
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

  defp menu_items(section, scope) do
    section
    |> section_items()
    |> filter_results(scope)
  end

  defp filter_results(items, scope), do: Enum.filter(items, &visible?(&1.visibility, scope))

  defp sections do
    [
      %{key: :navigation, title: dgettext("menu", "Navigation")},
      %{key: :settings, title: dgettext("menu", "Settings")},
      %{key: :support, title: dgettext("menu", "Support")}
    ]
  end

  defp courses do
    [
      %{label: "Elixir", navigate: ~p"/catalog?course=elixir"},
      %{label: "Phoenix", navigate: ~p"/catalog?course=phoenix"},
      %{label: "LiveView", navigate: ~p"/catalog?course=live_view"},
      %{label: "JavaScript", navigate: ~p"/catalog?course=javascript"}
    ]
  end

  defp search_courses(""), do: []

  defp search_courses(query) do
    FuzzySearch.search(courses(), query, & &1.label)
  end
end
