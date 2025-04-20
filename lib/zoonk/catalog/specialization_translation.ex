defmodule Zoonk.Catalog.SpecializationTranslation do
  @moduledoc """
  Defines the `SpecializationTranslation` schema.

  This schema stores translated content for specializations in different languages.
  Each specialization can have multiple translations, one for each supported language.

  ## Fields

  | Field Name         | Type        | Description                                             |
  |--------------------|-------------|---------------------------------------------------------|
  | `specialization_id`| Integer     | The ID of the specialization this translation belongs to.|
  | `language`         | Ecto.Enum   | The language of this translation.                       |
  | `title`            | String      | The title of the specialization in the specified language.|
  | `slug`             | String      | URL-friendly version of the title (case insensitive).   |
  | `description`      | String      | The description of the specialization in the specified language.|
  | `inserted_at`      | DateTime    | Timestamp when the translation was created.             |
  | `updated_at`       | DateTime    | Timestamp when the translation was last updated.        |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Catalog.Specialization
  alias Zoonk.Config.LanguageConfig

  schema "specialization_translations" do
    field :language, Ecto.Enum,
      values: LanguageConfig.list_languages(:atom),
      default: LanguageConfig.get_default_language(:atom)

    field :title, :string
    field :slug, :string
    field :description, :string

    belongs_to :specialization, Specialization

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(translation, attrs) do
    translation
    |> cast(attrs, [:specialization_id, :language, :title, :slug, :description])
    |> validate_required([:specialization_id, :language, :title, :slug, :description])
    |> validate_length(:title, min: 1, max: 255)
    |> validate_length(:slug, min: 1, max: 255)
    |> unique_constraint([:specialization_id, :language])
    |> unique_constraint([:language, :slug])
  end
end
