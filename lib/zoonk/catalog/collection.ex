defmodule Zoonk.Catalog.Collection do
  @moduledoc """
  Defines the `Collection` schema.

  Collections group related courses together, allowing users to enroll
  in multiple courses at once. Each collection belongs to an organization
  and can have multiple translations for different languages.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `org_id` | `Integer` | The ID of the organization that owns this collection. |
  | `categories` | `List` | List of categories the collection belongs to. |
  | `thumb_url` | `String` | URL for the collection thumbnail image. |
  | `inserted_at` | `DateTime` | Timestamp when the collection was created. |
  | `updated_at` | `DateTime` | Timestamp when the collection was last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Catalog.CollectionCourse
  alias Zoonk.Catalog.CollectionTranslation
  alias Zoonk.Catalog.CollectionUser
  alias Zoonk.Config.CategoryConfig
  alias Zoonk.Orgs.Org

  schema "collections" do
    field :categories, {:array, Ecto.Enum}, values: CategoryConfig.list_categories(:atom), default: []
    field :thumb_url, :string

    belongs_to :org, Org

    has_many :translations, CollectionTranslation
    has_many :collection_users, CollectionUser
    has_many :collection_courses, CollectionCourse

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(collection, attrs) do
    collection
    |> cast(attrs, [:org_id, :categories, :thumb_url])
    |> validate_required([:org_id, :categories])
  end
end
