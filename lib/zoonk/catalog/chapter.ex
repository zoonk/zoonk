defmodule Zoonk.Catalog.Chapter do
  @moduledoc """
  Defines the `Chapter` schema.

  Chapters represent learning units within the platform. Each chapter
  belongs to an organization and can have multiple translations for
  different languages.

  A chapter can be added to multiple courses. However, they
  can also be expanded into a course with multiple chapters.

  For example, we can have a basic "Frontend Development" chapter
  in the "Web Development" curse. Later, we can expand this
  chapter into its own course with multiple chapters like "HTML",
  "CSS", "JavaScript", etc.

  When we expand a chapter into a course, we add a new
  `course_id` field to the chapter. This allows us to keep track
  of the original chapter while also allowing it to be part of a larger
  course.

  Then, we can display a "Go Deeper" button on the chapter page
  for learners who want to dig deeper into the topic.

  If the `course_id` is `nil`, this means this chapter
  hasn't been expanded into a course yet.

  We only expand a chapter into a course when a learner
   clicks on the "Go Deeper" button in the UI.

  ## Fields

  | Field Name         | Type       | Description                                       |
  |--------------------|------------|---------------------------------------------------|
  | `org_id`           | `Integer`  | ID of the organization that owns this chapter.    |
  | `course_id`        | `Integer`  | Course that expands this chapter's content.       |
  | `categories`       | `List`     | List of categories the chapter belongs to.        |
  | `thumb_url`        | `String`   | URL for the chapter thumbnail image.              |
  | `inserted_at`      | `DateTime` | Timestamp when the chapter was created.           |
  | `updated_at`       | `DateTime` | Timestamp when the chapter was last updated.      |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Catalog.ChapterTranslation
  alias Zoonk.Catalog.Course
  alias Zoonk.Config.CategoryConfig
  alias Zoonk.Orgs.Org

  schema "chapters" do
    field :categories, {:array, Ecto.Enum}, values: CategoryConfig.list_categories(:atom), default: []
    field :thumb_url, :string

    belongs_to :org, Org
    belongs_to :course, Course

    has_many :translations, ChapterTranslation

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(chapter, attrs) do
    chapter
    |> cast(attrs, [:org_id, :course_id, :categories, :thumb_url])
    |> validate_required([:org_id, :categories])
  end
end
