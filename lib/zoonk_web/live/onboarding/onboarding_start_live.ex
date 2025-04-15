defmodule ZoonkWeb.Onboarding.OnboardingStartLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Catalog

  on_mount {ZoonkWeb.Onboarding.OnboardingPermissions, :onboarding_permissions}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <main class="h-dvh flex w-full items-center justify-center p-4">
      <div :if={is_nil(@selected_course)} class="absolute top-4 right-4">
        <.a kind={:button} size={:sm} navigate={~p"/login"}>
          {gettext("Login")}
        </.a>

        <.a kind={:button} variant={:outline} size={:sm} navigate={~p"/signup"}>
          {gettext("Sign Up")}
        </.a>
      </div>

      <div class="flex w-full max-w-lg flex-col items-center gap-4 text-center">
        <.text :if={is_nil(@selected_course)} tag="h1" size={:xxl}>
          {dgettext("onboarding", "What do you want to learn?")}
        </.text>

        <div :if={is_nil(@selected_course)}>
          <.command_trigger
            id="course-search-trigger"
            label={get_placeholder()}
            dialog_id="course-search-dialog"
          />
        </div>

        <div :if={@selected_course} class="flex w-full flex-col items-center gap-6">
          <.text variant={:secondary} class="animate-pulse">
            {dgettext("onboarding", "Building your learning path for %{title}...",
              title: @selected_course.title
            )}
          </.text>

          <.spinner class="size-12" />
        </div>
      </div>

      <.dialog id="course-search-dialog">
        <form
          phx-change={JS.push("search-courses", loading: "#command_list")}
          phx-submit="search-courses"
        >
          <.command_input placeholder={get_placeholder()} />
        </form>

        <.command_list id="command_list" class="group">
          <.command_empty :if={@course_results == []} class="group-[.phx-change-loading]:hidden">
            {dgettext("onboarding", "No courses found. Try a different search term.")}
          </.command_empty>

          <div class="hidden flex-col items-center justify-center py-8 group-[.phx-change-loading]:flex">
            <.spinner class="size-12" />
          </div>

          <.command_item
            :for={course <- @course_results}
            phx-click="select-course"
            phx-value-title={course.title}
            phx-value-description={course.description}
            class="group-[.phx-change-loading]:hidden"
          >
            <div class="flex flex-col">
              <span>{course.title}</span>
              <span class="text-zk-muted-foreground/90 text-xs">{course.description}</span>
            </div>
          </.command_item>
        </.command_list>
      </.dialog>
    </main>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, session, socket) do
    app_language = Map.get(session, "language", "en")

    socket =
      socket
      |> assign(:page_title, dgettext("onboarding", "Get Started"))
      |> assign(:course_results, [])
      |> assign(:app_language, app_language)
      |> assign(:selected_course, nil)

    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def handle_event("search-courses", %{"query" => query}, socket) when byte_size(query) > 2 do
    case Catalog.list_course_suggestions(query, socket.assigns.app_language) do
      {:ok, suggestions} ->
        {:noreply, assign(socket, :course_results, suggestions.courses)}

      {:error, _error} ->
        {:noreply, assign(socket, :course_results, [])}
    end
  end

  def handle_event("search-courses", _params, socket) do
    {:noreply, assign(socket, :course_results, [])}
  end

  def handle_event("select-course", %{"title" => title, "description" => description}, socket) do
    selected_course = %{title: title, description: description}

    socket = assign(socket, selected_course: selected_course)

    {:noreply, socket}
  end

  defp get_placeholder, do: dgettext("onboarding", "E.g. Computer Science, Astronomy, Biology, etc.")
end
