defmodule ZoonkWeb.CommandPaletteLive do
  @moduledoc """
  Command palette LiveComponent for quick navigation and search functionality.

  Provides a searchable command interface accessible via keyboard shortcuts
  or button trigger. Includes navigation links and actions.
  """
  use ZoonkWeb, :live_component
  use ZoonkWeb, :verified_routes

  import Zoonk.Config.MenuIconsConfig
  import ZoonkWeb.Components.Command
  import ZoonkWeb.Components.Dialog
  import ZoonkWeb.Components.Icon

  alias Zoonk.Helpers

  @impl Phoenix.LiveComponent
  def render(assigns) do
    ~H"""
    <div>
      <.command_trigger
        variant={:icon}
        label={gettext("Open command palette")}
        dialog_id={"command-palette-#{@id}"}
        phx-target={@myself}
      />

      <.dialog id={"command-palette-#{@id}"}>
        <form phx-change="search" phx-submit="search" phx-target={@myself}>
          <.command_input placeholder={gettext("Search commands...")} />
        </form>

        <.command_list>
          <.command_empty :if={
            @navigation_items == [] and @user_items == [] and @settings_items == [] and
              @support_items == []
          }>
            {gettext("No commands found.")}
          </.command_empty>

          <.command_group :if={@navigation_items != []} heading={gettext("Navigation")}>
            <.command_item :for={item <- @navigation_items} {build_nav_attrs(item)}>
              <.icon name={item.icon} class="size-4" />
              <span>{item.label}</span>
              <.command_shortcut :if={item[:shortcut]}>{item.shortcut}</.command_shortcut>
            </.command_item>
          </.command_group>

          <.command_separator :if={
            @navigation_items != [] and
              (@user_items != [] or @settings_items != [] or @support_items != [])
          } />

          <.command_group :if={@user_items != []} heading={dgettext("users", "My Account")}>
            <.command_item :for={item <- @user_items} {build_nav_attrs(item)}>
              <.icon name={item.icon} class="size-4" />
              <span>{item.label}</span>
              <.command_shortcut :if={item[:shortcut]}>{item.shortcut}</.command_shortcut>
            </.command_item>
          </.command_group>

          <.command_separator :if={
            @user_items != [] and (@settings_items != [] or @support_items != [])
          } />

          <.command_group :if={@settings_items != []} heading={gettext("Settings")}>
            <.command_item :for={item <- @settings_items} {build_nav_attrs(item)}>
              <.icon name={item.icon} class="size-4" />
              <span>{item.label}</span>
              <.command_shortcut :if={item[:shortcut]}>{item.shortcut}</.command_shortcut>
            </.command_item>
          </.command_group>

          <.command_separator :if={@settings_items != [] and @support_items != []} />

          <.command_group :if={@support_items != []} heading={dgettext("users", "Support")}>
            <.command_item :for={item <- @support_items} {build_nav_attrs(item)}>
              <.icon name={item.icon} class="size-4" />
              <span>{item.label}</span>
              <.command_shortcut :if={item[:shortcut]}>{item.shortcut}</.command_shortcut>
            </.command_item>
          </.command_group>
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
      |> assign_all_items()

    {:ok, socket}
  end

  @impl Phoenix.LiveComponent
  def handle_event("search", %{"query" => query}, socket) do
    socket = assign(socket, :query, query)

    case String.trim(query) do
      "" -> {:noreply, assign_all_items(socket)}
      trimmed_query -> {:noreply, assign_filtered_items(socket, trimmed_query)}
    end
  end

  defp navigation_items do
    [
      %{
        icon: get_icon(:home),
        label: gettext("Home page"),
        navigate: ~p"/"
      },
      %{
        icon: get_icon(:catalog),
        label: gettext("Catalog"),
        navigate: ~p"/catalog"
      },
      %{
        icon: get_icon(:start_course),
        label: gettext("Start new course"),
        navigate: ~p"/learn"
      }
    ]
  end

  defp user_items do
    [
      %{
        icon: get_icon(:my_courses),
        label: dgettext("users", "My courses"),
        navigate: ~p"/my-courses"
      },
      %{
        icon: get_icon(:missions),
        label: dgettext("users", "Missions"),
        navigate: ~p"/missions"
      },
      %{
        icon: get_icon(:purchases),
        label: dgettext("users", "Purchases"),
        navigate: ~p"/purchases"
      },
      %{
        icon: get_icon(:subscription),
        label: dgettext("users", "Subscription"),
        navigate: ~p"/subscription"
      }
    ]
  end

  defp settings_items do
    [
      %{
        icon: get_icon(:language),
        label: gettext("Change app language"),
        navigate: ~p"/language"
      },
      %{
        icon: get_icon(:display_name),
        label: gettext("Change display name"),
        navigate: ~p"/name"
      },
      %{
        icon: get_icon(:email),
        label: gettext("Change email address"),
        navigate: ~p"/email"
      }
    ]
  end

  defp support_items do
    [
      %{
        icon: get_icon(:feedback),
        label: dgettext("users", "Send feedback"),
        navigate: ~p"/feedback"
      },
      %{
        icon: get_icon(:support),
        label: dgettext("users", "Support"),
        navigate: ~p"/support"
      },
      %{
        icon: get_icon(:follow),
        label: gettext("Follow us on social media"),
        navigate: ~p"/follow"
      },
      %{
        icon: get_icon(:logout),
        label: dgettext("users", "Logout"),
        href: ~p"/logout",
        method: "delete"
      }
    ]
  end

  defp build_nav_attrs(item) do
    []
    |> maybe_add_attr(:navigate, item[:navigate])
    |> maybe_add_attr(:href, item[:href])
    |> maybe_add_attr(:method, item[:method])
  end

  defp maybe_add_attr(attrs, _key, nil), do: attrs
  defp maybe_add_attr(attrs, key, value), do: [{key, value} | attrs]

  defp assign_all_items(socket) do
    socket
    |> assign(navigation_items: navigation_items())
    |> assign(user_items: user_items())
    |> assign(settings_items: settings_items())
    |> assign(support_items: support_items())
  end

  defp assign_filtered_items(socket, query) do
    all_items = navigation_items() ++ user_items() ++ settings_items() ++ support_items()
    filtered_items = Helpers.fuzzy_search(all_items, query, & &1.label)

    socket
    |> assign(navigation_items: filter_by_category(filtered_items, navigation_items()))
    |> assign(user_items: filter_by_category(filtered_items, user_items()))
    |> assign(settings_items: filter_by_category(filtered_items, settings_items()))
    |> assign(support_items: filter_by_category(filtered_items, support_items()))
  end

  defp filter_by_category(filtered_items, category_items) do
    Enum.filter(filtered_items, &(&1 in category_items))
  end
end
