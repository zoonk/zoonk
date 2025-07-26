defmodule Zoonk.Catalog.CourseChapter do
  @moduledoc """
  Defines the `CourseChapter` schema.

  This schema represents the association between courses and chapters.
  It allows courses to contain multiple chapters and tracks the position
  of each chapter within the course for proper ordering.

  ## Fields

  | Field Name   | Type     | Description                                             |
  |--------------|----------|---------------------------------------------------------|
  | `org_id`     | Integer  | The ID of the organization this data belongs to.        |
  | `course_id`  | Integer  | The ID of the course that contains the chapter.         |
  | `chapter_id` | Integer  | The ID of the chapter included in the course.           |
  | `position`   | Integer  | Chapter's position within the course, used for ordering.|
  | `inserted_at`| DateTime | Timestamp when the association was created.             |
  | `updated_at` | DateTime | Timestamp when the association was last updated.        |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Catalog.Chapter
  alias Zoonk.Catalog.Course
  alias Zoonk.Orgs.Org

  schema "course_chapters" do
    field :position, :integer

    belongs_to :org, Org
    belongs_to :course, Course
    belongs_to :chapter, Chapter

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(course_chapter, attrs) do
    course_chapter
    |> cast(attrs, [:position])
    |> validate_required([:position])
  end
end
