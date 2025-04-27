defmodule Zoonk.Catalog.Course do
  @moduledoc """
  Defines the `Course` schema.

  Courses group related chapters together.
  They allow users to go deeper on a specific topic.

  Each course belongs to an organization
  and can have multiple translations for different languages.

  ## Fields

  | Field Name       | Type       | Description                                   |
  |------------------|------------|-----------------------------------------------|
  | `org_id`         | `Integer`  | The ID of the org that owns this course.      |
  | `slug`           | `String`   | Unique identifier for the course.             |
  | `categories`     | `List`     | List of categories the course belongs to.     |
  | `thumb_url`      | `String`   | URL for the course thumbnail image.           |
  | `translations`   | `List`     | List of translations for the course.          |
  | `course_users`   | `List`     | List of users associated with the course.     |
  | `course_chapters`| `List`     | List of chapters included in the course.      |
  | `inserted_at`    | `DateTime` | Timestamp when the course was created.        |
  | `updated_at`     | `DateTime` | Timestamp when the course was last updated.   |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Catalog.CourseChapter
  alias Zoonk.Catalog.CourseTranslation
  alias Zoonk.Catalog.CourseUser
  alias Zoonk.Config.CategoryConfig
  alias Zoonk.Orgs.Org

  schema "courses" do
    field :categories, {:array, Ecto.Enum}, values: CategoryConfig.list_categories(:atom), default: []
    field :thumb_url, :string
    field :slug, :string

    belongs_to :org, Org

    has_many :translations, CourseTranslation
    has_many :course_users, CourseUser
    has_many :course_chapters, CourseChapter

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(course, attrs) do
    course
    |> cast(attrs, [:org_id, :categories, :slug, :thumb_url])
    |> validate_required([:org_id, :categories, :slug])
    |> unique_constraint([:slug])
  end
end
