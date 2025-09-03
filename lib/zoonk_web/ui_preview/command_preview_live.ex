defmodule ZoonkWeb.UIPreview.CommandPreviewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.FuzzySearch

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.UIPreview.UIPreviewLayout.render active_page={:command} page_title={@page_title}>
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
            variant={:icon}
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

      <.card>
        <.card_header>
          <.card_title>Images Example</.card_title>
          <.card_description>
            Command menus can display images like course covers and profile pictures.
          </.card_description>
        </.card_header>

        <.card_content align={:bottom} class="flex flex-col gap-4">
          <.command_trigger
            id="courses-trigger"
            label="Search courses..."
            shortcut="i"
            dialog_id="courses-dialog"
          />
        </.card_content>
      </.card>

      <.dialog id="search-dialog">
        <form phx-change="search-docs" phx-submit="search-docs">
          <.command_input label="Type to search..." />
        </form>

        <.command_list>
          <.command_empty :if={@doc_results == []}>No documentation found.</.command_empty>
          <.command_item :for={item <- @doc_results}>
            <.icon name="tabler-file-text" />
            <span>{item.label}</span>
          </.command_item>
        </.command_list>
      </.dialog>

      <.dialog id="settings-dialog">
        <form phx-change="search-settings" phx-submit="search-settings">
          <.command_input label="Search settings..." icon="tabler-settings" />
        </form>

        <.command_list>
          <.command_empty :if={@settings_results == []}>No settings found.</.command_empty>
          <.command_item :for={item <- @settings_results}>
            <.icon name={item.icon} />
            <span>{item.label}</span>
            <.command_shortcut>{item.shortcut}</.command_shortcut>
          </.command_item>
        </.command_list>
      </.dialog>

      <.dialog id="groups-dialog">
        <form phx-change="search-groups" phx-submit="search-groups">
          <.command_input label="Search commands..." />
        </form>

        <.command_list>
          <.command_empty :if={@suggestions_results == [] and @groups_settings_results == []}>
            No commands found.
          </.command_empty>

          <.command_group :if={@suggestions_results != []} heading="Suggestions">
            <.command_item :for={item <- @suggestions_results}>
              <.icon name={item.icon} />
              <span>{item.label}</span>
            </.command_item>
          </.command_group>

          <.command_group :if={@groups_settings_results != []} heading="Settings">
            <.command_item :for={item <- @groups_settings_results}>
              <.icon name={item.icon} />
              <span>{item.label}</span>
              <.command_shortcut>{item.shortcut}</.command_shortcut>
            </.command_item>
          </.command_group>
        </.command_list>
      </.dialog>

      <.dialog id="courses-dialog">
        <form phx-change="search-courses" phx-submit="search-courses">
          <.command_input label="Search courses and instructors..." />
        </form>

        <.command_list>
          <.command_empty :if={@courses_results == [] and @instructors_results == []}>
            No courses or instructors found.
          </.command_empty>

          <.command_group :if={@courses_results != []} heading="Courses">
            <.command_item :for={course <- @courses_results}>
              <.avatar size={:xs} src={course.cover} alt={course.label} />
              <div class="flex flex-col">
                <span>{course.label}</span>
                <span class="text-zk-muted-foreground/90 text-sm">{course.instructor}</span>
              </div>
            </.command_item>
          </.command_group>

          <.command_group :if={@instructors_results != []} heading="Instructors">
            <.command_item :for={instructor <- @instructors_results}>
              <.avatar size={:xs} src={instructor.avatar} alt={instructor.label} />
              <span>{instructor.label}</span>
            </.command_item>
          </.command_group>
        </.command_list>
      </.dialog>
    </ZoonkWeb.UIPreview.UIPreviewLayout.render>
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
      |> assign(courses_results: courses())
      |> assign(instructors_results: instructors())

    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def handle_event("search-docs", %{"query" => query}, socket) do
    results = FuzzySearch.search(documentation_items(), query, & &1.label)
    {:noreply, assign(socket, doc_results: results)}
  end

  def handle_event("search-settings", %{"query" => query}, socket) do
    results = FuzzySearch.search(settings(), query, & &1.label)
    {:noreply, assign(socket, settings_results: results)}
  end

  def handle_event("search-groups", %{"query" => query}, socket) do
    suggestions_results = FuzzySearch.search(suggestions(), query, & &1.label)
    groups_settings_results = FuzzySearch.search(settings(), query, & &1.label)

    {:noreply,
     assign(socket,
       suggestions_results: suggestions_results,
       groups_settings_results: groups_settings_results
     )}
  end

  def handle_event("search-courses", %{"query" => query}, socket) do
    courses_results = FuzzySearch.search(courses(), query, & &1.label)
    instructors_results = FuzzySearch.search(instructors(), query, & &1.label)

    {:noreply,
     assign(socket,
       courses_results: courses_results,
       instructors_results: instructors_results
     )}
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

  def courses do
    [
      %{
        label: "Deep Learning with PyTorch",
        instructor: "Sam Shaw",
        cover: "https://github.com/pytorch.png"
      },
      %{
        label: "Next.js Full Stack Development",
        instructor: "Lee Robinson",
        cover: "https://github.com/vercel.png"
      },
      %{
        label: "Open Source Development",
        instructor: "Nat Friedman",
        cover: "https://github.com/github.png"
      },
      %{
        label: "Space Science and Technology",
        instructor: "Katie Stack",
        cover: "https://github.com/nasa.png"
      },
      %{
        label: "Digital Knowledge and Research",
        instructor: "Jimmy Wales",
        cover: "https://github.com/wikimedia.png"
      },
      %{
        label: "Machine Learning with Scikit-learn",
        instructor: "Dan Abramov",
        cover: "https://github.com/scikit-learn.png"
      },
      %{
        label: "Environmental Activism",
        instructor: "Sindre Sorhus",
        cover: "https://github.com/greenpeace.png"
      },
      %{
        label: "Web Development with Elixir",
        instructor: "Jose Valim",
        cover: "https://github.com/elixir-lang.png"
      }
    ]
  end

  def instructors do
    [
      %{
        label: "Sam Shaw",
        avatar: "https://github.com/shadcn.png"
      },
      %{
        label: "Lee Robinson",
        avatar: "https://github.com/leerob.png"
      },
      %{
        label: "Nat Friedman",
        avatar: "https://github.com/defunkt.png"
      },
      %{
        label: "Cassidy Williams",
        avatar: "https://github.com/cassidoo.png"
      },
      %{
        label: "Prosper Otemuyiwa",
        avatar: "https://github.com/unicodeveloper.png"
      },
      %{
        label: "Dan Abramov",
        avatar: "https://github.com/gaearon.png"
      },
      %{
        label: "Sindre Sorhus",
        avatar: "https://github.com/sindresorhus.png"
      },
      %{
        label: "Jose Valim",
        avatar: "https://github.com/josevalim.png"
      }
    ]
  end
end
