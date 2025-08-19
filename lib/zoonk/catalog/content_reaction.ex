defmodule Zoonk.Catalog.ContentReaction do
  @moduledoc """
  Defines the `ContentReaction` schema.

  We allow users to evaluate AI-generated schema with reactions
  like thumbs up or down. This helps us improve the quality
  of AI generations and catch potential issues early.

  Every AI-generated content must always have a UI where
  users can add reactions.

  However, that isn't useful only to AI-generated content.
  This schema is generic enough to be used for any type of content
  that requires user feedback, allowing us to extend it
  to other kinds of reactions like emojis, likes, etc.

  ## Fields

  | Field Name   | Type     | Description                                              |
  |------------- |----------|----------------------------------------------------------|
  | `org_id`     | Integer  | ID of the organization this content belongs to.          |
  | `content_id` | Integer  | The content ID for which the reaction is made.           |
  | `user_id`    | Integer  | ID of the user who made the reaction.                    |
  | `reaction`   | Enum     | The type of reaction (e.g., thumbs up, thumbs down).     |
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Zoonk.Accounts.User
  alias Zoonk.Catalog.Content
  alias Zoonk.Orgs.Org

  schema "content_reactions" do
    field :reaction, Ecto.Enum, values: [:thumbs_up, :thumbs_down]

    belongs_to :org, Org
    belongs_to :content, Content
    belongs_to :user, User

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(reaction, attrs) do
    reaction
    |> cast(attrs, [:content_id, :reaction])
    |> validate_required([:content_id, :reaction])
  end
end
