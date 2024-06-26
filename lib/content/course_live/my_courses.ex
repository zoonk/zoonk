defmodule ZoonkWeb.Live.MyCourses do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.Components.Content.CourseList

  alias Zoonk.Content

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    %{current_user: user, school: school} = socket.assigns

    courses = Content.list_courses_by_user(school.id, user.id, :student)

    socket =
      socket
      |> assign(:page_title, gettext("My courses"))
      |> stream(:courses, courses)
      |> assign(:courses_empty?, Enum.empty?(courses))

    {:ok, socket}
  end
end
