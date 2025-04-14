defmodule Zoonk.Catalog.CollectionCourse do
  @moduledoc """
  Defines the `CollectionCourse` schema.

  This schema represents the association between collections and courses.
  It allows collections to contain multiple courses and tracks the position
  of each course within the collection for proper ordering.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `collection_id` | `Integer` | The ID of the collection that contains the course. |
  | `course_id` | `Integer` | The ID of the course included in the collection. |
  | `position` | `Integer` | The position of the course within the collection (for ordering). |
  | `inserted_at` | `DateTime` | Timestamp when the association was created. |
  | `updated_at` | `DateTime` | Timestamp when the association was last updated. |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Catalog.Collection
  alias Zoonk.Catalog.Course

  schema "collection_courses" do
    field :position, :integer

    belongs_to :collection, Collection
    belongs_to :course, Course

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(collection_course, attrs) do
    collection_course
    |> cast(attrs, [:collection_id, :course_id, :position])
    |> validate_required([:collection_id, :course_id, :position])
    |> unique_constraint([:collection_id, :course_id])
  end
end
