defmodule Zoonk.Catalog.Content do
  @moduledoc """
  Defines the `Content` schema.

  It serves as a unified registry for various types of content
  such as courses, chapters, lessons, exercises, and more, providing
  each with a shared identifier (`content_id`).

  This design enables cross-type relations—like reactions, ratings,
  bookmarks, and feedback—to reference a single `contents` table
  instead of duplicating `(type, id)` pairs across multiple tables.

  By centralizing these references, it ensures consistent foreign key
  relationships, supports cascading deletes, and avoids the need to
  replicate polymorphic logic in multiple places.

  Domain-specific fields such as `slug`, `title`, and `thumb_url`
  remain on their respective typed tables (e.g., `courses`, `chapters`),
  while the `Content` schema is dedicated solely to global identity and
  facilitating cross-type joins.

  It can also be used to display a timeline of all content created
  by an organization, which can be useful for moderation and audit logs.

  ## Fields

  | Field Name   | Type     | Description                                                           |
  | ------------ | -------- | --------------------------------------------------------------------- |
  | `org_id`     | Integer  | The ID of the `Zoonk.Orgs.Org` that owns this content.                |
  | `kind`       | Enum     | The type of content, such as `:course`, `:chapter`, `:lesson`, etc.   |
  | `inserted_at`| DateTime | Timestamp when the content was created.                               |
  | `updated_at` | DateTime | Timestamp when the content was last updated.                          |
  """
  use Ecto.Schema

  schema "contents" do
    field :kind, Ecto.Enum, values: [:course, :chapter, :course_suggestion]

    belongs_to :org, Zoonk.Orgs.Org

    timestamps(type: :utc_datetime_usec)
  end
end
