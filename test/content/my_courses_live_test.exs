defmodule ZoonkWeb.MyCoursesLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Phoenix.LiveViewTest
  import Zoonk.Fixtures.Content
  import Zoonk.Fixtures.Organizations

  describe "my courses (non-authenticated users)" do
    setup :set_school

    test "redirects to the login page", %{conn: conn} do
      result = get(conn, ~p"/courses/my")
      assert redirected_to(result) == ~p"/users/login"
    end
  end

  describe "my courses (authenticated)" do
    setup :app_setup

    test "lists all courses from the current user", %{conn: conn, school: school, user: user} do
      courses = Enum.map(1..3, fn idx -> course_fixture(%{name: "Course #{idx}!", school: school}) end)
      Enum.each(courses, fn course -> course_user_fixture(%{course: course, user: user}) end)
      other_course = course_fixture(%{name: "Other course!", school: school})

      {:ok, lv, _html} = live(conn, ~p"/courses/my")

      assert has_element?(lv, ~s|li[aria-current=page] a:fl-icontains("my courses")|)

      Enum.each(courses, fn course -> assert has_element?(lv, ~s|a[href="/c/#{course.slug}"]|) end)
      refute has_element?(lv, ~s|a[href="/c/#{other_course.slug}"]|)
    end

    test "displays a message when there are no courses", %{conn: conn} do
      {:ok, lv, _html} = live(conn, ~p"/courses/my")

      assert has_element?(lv, ~s|a:fl-icontains("browse courses")|)
      assert has_element?(lv, ~s|p:fl-icontains("get started by joining a course.")|)
    end

    test "doesn't display courses from a child school", %{conn: conn, school: school, user: user} do
      child_school = school_fixture(%{school_id: school.id})
      course = course_fixture(%{school: child_school})
      course_user_fixture(%{course: course, user: user})

      {:ok, lv, _html} = live(conn, ~p"/courses/my")

      refute has_element?(lv, ~s|a[href="/c/#{course.slug}"]|)
    end
  end
end
