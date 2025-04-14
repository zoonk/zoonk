defmodule Zoonk.Catalog.CourseTranslation do
  @moduledoc """
  Defines the `CourseTranslation` schema.

  This schema stores translated content for courses in different languages.
  Each course can have multiple translations, one for each supported language.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `course_id` | `Integer` | The ID of the course this translation belongs to. |
  | `language` | `Ecto.Enum` | The language of this translation. |
  | `title` | `String` | The title of the course in the specified language. |
  | `slug` | `String` | URL-friendly version of the title (case insensitive). |
  | `description` | `String` | The description of the course in the specified language. |
  | `inserted_at` | `DateTime` | Timestamp when the translation was created. |
  | `updated_at` | `DateTime` | Timestamp when the translation was last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Catalog.Course
  alias Zoonk.Config.LanguageConfig

  schema "course_translations" do
    field :language, Ecto.Enum,
      values: LanguageConfig.list_languages(:atom),
      default: LanguageConfig.get_default_language(:atom)

    field :title, :string
    field :slug, :string
    field :description, :string

    belongs_to :course, Course

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(translation, attrs) do
    translation
    |> cast(attrs, [:course_id, :language, :title, :description, :slug])
    |> validate_required([:course_id, :language, :title, :description, :slug])
    |> validate_length(:title, min: 1, max: 255)
    |> validate_length(:slug, min: 1, max: 255)
    |> unique_constraint([:course_id, :language])
    |> unique_constraint([:language, :slug])
  end
end
