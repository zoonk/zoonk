defmodule Zoonk.Catalog.CourseUser do
  @moduledoc """
  Defines the `CourseUser` schema.

  This schema represents the association between users and courses.
  It tracks which users have access to which courses and their roles.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `course_id` | `Integer` | The ID of the course the user has access to. |
  | `user_id` | `Integer` | The ID of the user who has access to the course. |
  | `role` | `Ecto.Enum` | The role of the user in the course (editor or member). |
  | `inserted_at` | `DateTime` | Timestamp when the association was created. |
  | `updated_at` | `DateTime` | Timestamp when the association was last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Accounts.User
  alias Zoonk.Catalog.Course

  schema "course_users" do
    field :role, Ecto.Enum, values: [:editor, :member], default: :member

    belongs_to :course, Course
    belongs_to :user, User

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(course_user, attrs) do
    course_user
    |> cast(attrs, [:course_id, :user_id, :role])
    |> validate_required([:course_id, :user_id, :role])
    |> unique_constraint([:course_id, :user_id])
  end
end
