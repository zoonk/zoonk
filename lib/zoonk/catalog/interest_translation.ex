defmodule Zoonk.Catalog.InterestTranslation do
  @moduledoc """
  Defines the `InterestTranslation` schema.

  This schema stores translated content for interests in different languages.
  Each interest can have multiple translations, one for each supported language.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `interest_id` | `Integer` | The ID of the interest this translation belongs to. |
  | `language` | `Ecto.Enum` | The language of this translation. |
  | `title` | `String` | The title of the interest in the specified language. |
  | `slug` | `String` | URL-friendly version of the title (case insensitive). |
  | `description` | `String` | The description of the interest in the specified language. |
  | `inserted_at` | `DateTime` | Timestamp when the translation was created. |
  | `updated_at` | `DateTime` | Timestamp when the translation was last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Catalog.Interest
  alias Zoonk.Config.LanguageConfig

  schema "interest_translations" do
    field :language, Ecto.Enum,
      values: LanguageConfig.list_languages(:atom),
      default: LanguageConfig.get_default_language(:atom)

    field :title, :string
    field :slug, :string
    field :description, :string

    belongs_to :interest, Interest

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(translation, attrs) do
    translation
    |> cast(attrs, [:interest_id, :language, :title, :description, :slug])
    |> validate_required([:interest_id, :language, :title, :slug])
    |> validate_length(:title, min: 1, max: 255)
    |> validate_length(:slug, min: 1, max: 255)
    |> unique_constraint([:interest_id, :language])
    |> unique_constraint([:language, :slug])
  end
end
