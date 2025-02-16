defmodule ZoonkSchema.UserToken do
  @moduledoc false
  use Ecto.Schema

  schema "users_tokens" do
    field :token, :binary
    field :context, :string
    field :sent_to, :string
    belongs_to :user, ZoonkSchema.User

    timestamps(type: :utc_datetime, updated_at: false)
  end
end
