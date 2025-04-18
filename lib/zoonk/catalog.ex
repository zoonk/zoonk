defmodule Zoonk.Catalog do
  @moduledoc """
  The Catalog context.

  This context handles operations related to courses and their translations.
  It provides a way to manage educational content within the platform.
  """

  import Ecto.Query, warn: false

  alias Zoonk.Catalog.CourseUser
  alias Zoonk.Repo

  @doc """
  Checks if a user is enrolled in any course.

  Returns `true` if the user is enrolled in at least one course, `false` otherwise.

  ## Examples

      iex> user_enrolled_in_any_course?(user_id)
      true

      iex> user_enrolled_in_any_course?(user_id_with_no_courses)
      false
  """
  def user_enrolled_in_any_course?(user_id) do
    CourseUser
    |> where([cu], cu.user_id == ^user_id)
    |> limit(1)
    |> Repo.exists?()
  end
end
