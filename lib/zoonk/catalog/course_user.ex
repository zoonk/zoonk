defmodule Zoonk.Catalog.CourseUser do
  @moduledoc """
  Defines the `CourseUser` schema.

  This schema represents the association between users and courses.
  It tracks which users have access to which courses and their roles.

  ## Fields

  | Field Name         | Type        | Description                                               |
  |--------------------|-------------|-----------------------------------------------------------|
  | `org_id`           | Integer     | The ID of the organization this data belongs to.          |
  | `course_id`        | Integer     | The ID of the course the user has access to.              |
  | `user_id`          | Integer     | The ID of the user who has access to the course.          |
  | `role`             | Ecto.Enum   | The role of the user in the course.                       |
  | `inserted_at`      | DateTime    | Timestamp when the association was created.               |
  | `updated_at`       | DateTime    | Timestamp when the association was last updated.          |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Accounts.User
  alias Zoonk.Catalog.Course
  alias Zoonk.Orgs.Org

  schema "course_users" do
    field :role, Ecto.Enum, values: [:editor, :member], default: :member

    belongs_to :org, Org
    belongs_to :course, Course
    belongs_to :user, User

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(course_user, attrs) do
    course_user
    |> cast(attrs, [:role])
    |> validate_required([:role])
    |> unique_constraint([:org_id, :course_id, :user_id])
  end
end
