defmodule Zoonk.Catalog.ChapterTranslation do
  @moduledoc """
  Defines the `ChapterTranslation` schema.

  This schema stores translated content for chapters in different languages.
  Each chapter can have multiple translations, one for each supported language.

  ## Fields

  | Field Name   | Type        | Description                                              |
  |--------------|-------------|----------------------------------------------------------|
  | `chapter_id` | `Integer`   | The ID of the chapter this translation belongs to.       |
  | `language`   | `Ecto.Enum` | The language of this translation.                        |
  | `title`      | `String`    | The title of the chapter in the specified language.      |
  | `description`| `String`    | The description of the chapter in the specified language.|
  | `inserted_at`| `DateTime`  | Timestamp when the translation was created.              |
  | `updated_at` | `DateTime`  | Timestamp when the translation was last updated.         |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Catalog.Chapter
  alias Zoonk.Config.LanguageConfig

  schema "chapter_translations" do
    field :language, Ecto.Enum,
      values: LanguageConfig.list_languages(:atom),
      default: LanguageConfig.get_default_language(:atom)

    field :title, :string
    field :description, :string

    belongs_to :chapter, Chapter

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(translation, attrs) do
    translation
    |> cast(attrs, [:chapter_id, :language, :title, :description])
    |> validate_required([:chapter_id, :language, :title, :description])
    |> validate_length(:title, min: 1, max: 255)
    |> unique_constraint([:chapter_id, :language])
  end
end
