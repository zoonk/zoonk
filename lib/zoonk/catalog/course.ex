defmodule Zoonk.Catalog.Course do
  @moduledoc """
  Defines the `Course` schema.

  Courses represent educational content within the platform. Each course
  belongs to an organization and can have multiple translations for
  different languages.

  A course can be added to multiple specializations. However, they
  can also be expanded into a specialization with multiple courses.

  For example, we can have a basic "Frontend Development" course
  in the "Web Development" specialization. Later, we can expand this
  course into its own specialization with multiple courses like "HTML",
  "CSS", "JavaScript", etc.

  When we expand a course into a specialization, we add a new
  `specialization_id` field to the course. This allows us to keep track
  of the original course while also allowing it to be part of a larger
  specialization.

  Then, we can display a "Specialization" button on the course page
  for learners who want to dig deeper into the topic.

  If the `specialization_id` is `nil`, this means this course
  hasn't been expanded into a specialization yet.

  We only expand a course into a specialization when a learner
  clicks on the "Specialization" button in the UI.

  ## Fields

  | Field Name         | Type       | Description                                       |
  |--------------------|------------|---------------------------------------------------|
  | `org_id`           | `Integer`  | ID of the organization that owns this course.     |
  | `specialization_id`| `Integer`  | Specialization that expands this course's content.|
  | `categories`       | `List`     | List of categories the course belongs to.         |
  | `thumb_url`        | `String`   | URL for the course thumbnail image.               |
  | `inserted_at`      | `DateTime` | Timestamp when the course was created.            |
  | `updated_at`       | `DateTime` | Timestamp when the course was last updated.       |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Catalog.CourseTranslation
  alias Zoonk.Catalog.CourseUser
  alias Zoonk.Catalog.Specialization
  alias Zoonk.Config.CategoryConfig
  alias Zoonk.Orgs.Org

  schema "courses" do
    field :categories, {:array, Ecto.Enum}, values: CategoryConfig.list_categories(:atom), default: []
    field :thumb_url, :string

    belongs_to :org, Org
    belongs_to :specialization, Specialization

    has_many :translations, CourseTranslation
    has_many :course_users, CourseUser

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(course, attrs) do
    course
    |> cast(attrs, [:org_id, :specialization_id, :categories, :thumb_url])
    |> validate_required([:org_id, :categories])
  end
end
