defmodule Zoonk.Catalog.CourseSuggestion do
  @moduledoc """
  Schema for storing course suggestions.

  This schema stores user queries when they want to learn
  a subject along with the AI-generated course suggestions.

  Storing these suggestions allows us to avoid repeated
  AI calls for common queries.

  ## Fields

  | Field Name       | Type        | Description                                        |
  |------------------|-------------|--------------------------------------------------- |
  | `content_id`     | `Integer`   | The ID of `Zoonk.Catalog.Content` being suggested. |
  | `query`          | `String`    | The user's input about what they want to learn.    |
  | `language`       | `Ecto.Enum` | The language of the query and suggestions.         |
  | `suggestions`    | `List`      | Collection of suggested courses.                   |
  | `inserted_at`    | `DateTime`  | Timestamp when the suggestion was created.         |
  | `updated_at`     | `DateTime`  | Timestamp when the suggestion was updated.         |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Catalog.Content
  alias Zoonk.Localization

  schema "course_suggestions" do
    field :query, :string

    field :language, Ecto.Enum,
      values: Localization.list_languages(:atom),
      default: Localization.default_language(:atom)

    belongs_to :content, Content

    embeds_many :suggestions, Suggestion do
      field :title, :string
      field :description, :string
      field :icon, :string
      field :english_title, :string
    end

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(course_suggestion, attrs) do
    course_suggestion
    |> cast(attrs, [:query, :language])
    |> validate_required([:query, :language])
    |> cast_embed(:suggestions, with: &suggestion_changeset/2)
  end

  defp suggestion_changeset(suggestion, attrs) do
    cast(suggestion, attrs, [:title, :description, :english_title, :icon])
  end
end
