defmodule Zoonk.Catalog.SpecializationCourse do
  @moduledoc """
  Defines the `SpecializationCourse` schema.

  This schema represents the association between specializations and courses.
  It allows specializations to contain multiple courses and tracks the position
  of each course within the specialization for proper ordering.

  ## Fields

  | Field Name         | Type      | Description                                                    |
  |--------------------|-----------|----------------------------------------------------------------|
  | `org_id`           | Integer   | The ID of the organization this data belongs to.              |
  | `specialization_id`| Integer   | The ID of the specialization that contains the course          |
  | `course_id`        | Integer   | The ID of the course included in the specialization            |
  | `position`         | Integer   | Course's position within the specialization, used for ordering |
  | `level`            | Integer   | The level of the course within the specialization              |
  | `inserted_at`      | DateTime  | Timestamp when the association was created                     |
  | `updated_at`       | DateTime  | Timestamp when the association was last updated                |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Catalog.Course
  alias Zoonk.Catalog.Specialization
  alias Zoonk.Orgs.Org

  schema "specialization_courses" do
    field :level, :integer
    field :position, :integer

    belongs_to :org, Org
    belongs_to :specialization, Specialization
    belongs_to :course, Course

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(specialization_course, attrs) do
    specialization_course
    |> cast(attrs, [:org_id, :specialization_id, :course_id, :position, :level])
    |> validate_required([:org_id, :specialization_id, :course_id, :position, :level])
    |> unique_constraint([:org_id, :specialization_id, :course_id])
  end
end
