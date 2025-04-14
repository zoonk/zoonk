defmodule Zoonk.Catalog.Course do
  @moduledoc """
  Defines the `Course` schema.

  Courses represent educational content within the platform. Each course
  belongs to an organization and can have multiple translations for
  different languages.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `org_id` | `Integer` | The ID of the organization that owns this course. |
  | `categories` | `List` | List of categories the course belongs to. |
  | `thumb_url` | `String` | URL for the course thumbnail image. |
  | `inserted_at` | `DateTime` | Timestamp when the course was created. |
  | `updated_at` | `DateTime` | Timestamp when the course was last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Catalog.CourseTranslation
  alias Zoonk.Catalog.CourseUser
  alias Zoonk.Config.CategoryConfig
  alias Zoonk.Orgs.Org

  schema "courses" do
    field :categories, {:array, Ecto.Enum}, values: CategoryConfig.list_categories(:atom), default: []
    field :thumb_url, :string

    belongs_to :org, Org
    has_many :translations, CourseTranslation
    has_many :course_users, CourseUser

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(course, attrs) do
    course
    |> cast(attrs, [:org_id, :categories, :thumb_url])
    |> validate_required([:org_id, :categories])
  end
end
