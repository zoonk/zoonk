defmodule Zoonk.Catalog.SpecializationCourse do
  @moduledoc """
  Defines the `SpecializationCourse` schema.

  This schema represents the association between specializations and courses.
  It allows specializations to contain multiple courses and tracks the position
  of each course within the specialization for proper ordering.

  ## Fields

  | Field Name         | Type      | Description                                                    |
  |--------------------|-----------|----------------------------------------------------------------|
  | `specialization_id`| Integer   | The ID of the specialization that contains the course          |
  | `course_id`        | Integer   | The ID of the course included in the specialization            |
  | `position`         | Integer   | Course's position within the specialization, used for ordering |
  | `inserted_at`      | DateTime  | Timestamp when the association was created                     |
  | `updated_at`       | DateTime  | Timestamp when the association was last updated                |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Catalog.Course
  alias Zoonk.Catalog.Specialization

  schema "specialization_courses" do
    field :position, :integer

    belongs_to :specialization, Specialization
    belongs_to :course, Course

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(specialization_course, attrs) do
    specialization_course
    |> cast(attrs, [:specialization_id, :course_id, :position])
    |> validate_required([:specialization_id, :course_id, :position])
    |> unique_constraint([:specialization_id, :course_id])
  end
end
