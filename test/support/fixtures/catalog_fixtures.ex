defmodule Zoonk.CatalogFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `Zoonk.Catalog` context.
  """

  alias Zoonk.Catalog.Course
  alias Zoonk.Catalog.CourseUser
  alias Zoonk.Repo

  @doc """
  Creates a course.

  ## Examples

      iex> course_fixture()
      %Course{}

      iex> course_fixture(%{title: "Elixir Basics"})
      %Course{title: "Elixir Basics"}
  """
  def course_fixture(attrs \\ %{}) do
    org = Map.get_lazy(attrs, :org, fn -> Zoonk.OrgFixtures.org_fixture() end)

    attrs =
      Enum.into(attrs, %{org_id: org.id})

    %Course{}
    |> Course.changeset(attrs)
    |> Repo.insert!()
  end

  @doc """
  Creates a course user association.

  ## Examples

      iex> course_user_fixture(%{course: %Course{}, user: %User{}})
      %CourseUser{}

      iex> course_user_fixture(%{role: :editor})
      %CourseUser{role: :editor}
  """
  def course_user_fixture(attrs \\ %{}) do
    course = Map.get_lazy(attrs, :course, fn -> course_fixture() end)
    user = Map.get_lazy(attrs, :user, fn -> Zoonk.AccountFixtures.user_fixture() end)
    attrs = Enum.into(attrs, %{org_id: course.org_id, course_id: course.id, user_id: user.id, role: :member})

    %CourseUser{}
    |> CourseUser.changeset(attrs)
    |> Repo.insert!()
  end
end
