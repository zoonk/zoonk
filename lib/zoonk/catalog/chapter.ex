defmodule Zoonk.Catalog.Chapter do
  @moduledoc """
  Defines the `Chapter` schema.

  Chapters represent learning units within the platform. Each chapter
  belongs to an organization and can have multiple translations for
  different languages.

  A chapter can be added to multiple courses.

  ## Fields

  | Field Name         | Type       | Description                                       |
  |--------------------|------------|---------------------------------------------------|
  | `org_id`           | `Integer`  | ID of the organization that owns this chapter.    |
  | `content_id`       | `Integer`  | The content ID for this chapter.                  |
  | `slug`             | `String`   | Unique identifier for the chapter.                |
  | `thumb_url`        | `String`   | URL for the chapter thumbnail image.              |
  | `inserted_at`      | `DateTime` | Timestamp when the chapter was created.           |
  | `updated_at`       | `DateTime` | Timestamp when the chapter was last updated.      |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Catalog.ChapterTranslation
  alias Zoonk.Catalog.Content
  alias Zoonk.Orgs.Org

  schema "chapters" do
    field :slug, :string
    field :thumb_url, :string

    belongs_to :org, Org
    belongs_to :content, Content

    has_many :translations, ChapterTranslation

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(chapter, attrs) do
    chapter
    |> cast(attrs, [:slug, :thumb_url])
    |> validate_required([:slug])
    |> unsafe_validate_unique([:org_id, :slug], Zoonk.Repo)
    |> unique_constraint([:org_id, :slug])
  end
end
