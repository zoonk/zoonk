defmodule Zoonk.Accounts.UserToken do
  @moduledoc """
  Represents authentication and verification tokens for users.

  We send tokens to users when they try to sign in or sign up
  using a magic link, or when they change their email address.

  ## Fields

  | Field Name | Type | Description |
  |------------|------|-------------|
  | `token` | `Binary` | The token used for authentication or verification. |
  | `context` | `String` | The context in which the token is used (e.g., "email_verification"). |
  | `sent_to` | `String` | The email address or phone number to which the token was sent. |
  | `user_id` | `Integer` | The ID from `Zoonk.Accounts.User`. |
  | `inserted_at` | `DateTime` | Timestamp when the token was created. |
  | `updated_at` | `DateTime` | Timestamp when the token was last updated. |
  """
  use Ecto.Schema

  import Ecto.Query

  alias Zoonk.Accounts.UserToken
  alias Zoonk.Config.AuthConfig

  @rand_size 32

  schema "users_tokens" do
    field :token, :binary
    field :context, :string
    field :sent_to, :string
    field :authenticated_at, :utc_datetime_usec

    belongs_to :user, Zoonk.Accounts.User

    timestamps(type: :utc_datetime_usec, updated_at: false)
  end

  @doc """
  Generates a token that will be stored in a signed place,
  such as session or cookie. As they are signed, those
  tokens do not need to be hashed.

  The reason why we store session tokens in the database, even
  though Phoenix already provides a session cookie, is because
  Phoenix' default session cookies are not persisted, they are
  simply signed and potentially encrypted. This means they are
  valid indefinitely, unless you change the signing/encryption
  salt.

  Therefore, storing them allows individual user
  sessions to be expired. The token system can also be extended
  to store additional data, such as the device used for logging in.
  You could then use this information to display all valid sessions
  and devices in the UI and allow users to explicitly expire any
  session they deem invalid.
  """
  def build_session_token(user) do
    token = :crypto.strong_rand_bytes(@rand_size)

    dt = user.authenticated_at || DateTime.utc_now()
    {token, %UserToken{token: token, context: "session", user_id: user.id, authenticated_at: dt}}
  end

  @doc """
  Checks if the token is valid and returns its underlying lookup query.

  The query returns the user found by the token, if any, along with the token's creation time.

  The token is valid if it matches the value in the database and it has
  not expired (after @session_validity_in_days).
  """
  def verify_session_token_query(token) do
    session_validity_in_days = AuthConfig.get_max_age(:token, :days)

    query =
      token
      |> by_token_and_context_query("session")
      |> join(:inner, [token], user in assoc(token, :user))
      |> where([token, user], token.inserted_at > ago(^session_validity_in_days, "day"))
      |> select([token, user], {%{user | authenticated_at: token.authenticated_at}, token.inserted_at})

    {:ok, query}
  end

  @doc """
  Builds a token and its hash to be delivered to the user's email.

  The non-hashed token is sent to the user email while the
  hashed part is stored in the database. The original token cannot be reconstructed,
  which means anyone with read-only access to the database cannot directly use
  the token in the application to gain access. Furthermore, if the user changes
  their email in the system, the tokens sent to the previous email are no longer
  valid.

  Users can easily adapt the existing code to provide other types of delivery methods,
  for example, by phone numbers.
  """
  def build_email_token(user, context) do
    build_hashed_token(user, context, user.email)
  end

  defp build_hashed_token(user, context, sent_to) do
    token = :crypto.strong_rand_bytes(@rand_size)
    hashed_token = :crypto.hash(AuthConfig.get_hash_algorithm(), token)

    {Base.url_encode64(token, padding: false),
     %UserToken{
       token: hashed_token,
       context: context,
       sent_to: sent_to,
       user_id: user.id
     }}
  end

  @doc """
  Checks if the token is valid and returns its underlying lookup query.

  If found, the query returns a tuple of the form `{user, token}`.

  The given token is valid if it matches its hashed counterpart in the
  database. This function also checks if the token is being used within
  15 minutes. The context of a magic link token is always "login".
  """
  def verify_magic_link_token_query(token) do
    case Base.url_decode64(token, padding: false) do
      {:ok, decoded_token} ->
        hashed_token = :crypto.hash(AuthConfig.get_hash_algorithm(), decoded_token)

        query =
          hashed_token
          |> by_token_and_context_query("login")
          |> join(:inner, [token], user in assoc(token, :user))
          |> where([token], token.inserted_at > ago(^AuthConfig.get_max_age(:magic_link, :minutes), "minute"))
          |> where([token, user], token.sent_to == user.email)
          |> select([token, user], {user, token})

        {:ok, query}

      :error ->
        :error
    end
  end

  @doc """
  Checks if the token is valid and returns its underlying lookup query.

  The query returns the user_token found by the token, if any.

  This is used to validate requests to change the user
  email.
  The given token is valid if it matches its hashed counterpart in the
  database and if it has not expired.
  The context must always start with "change:".
  """
  def verify_change_email_token_query(token, "change:" <> _rest = context) do
    case Base.url_decode64(token, padding: false) do
      {:ok, decoded_token} ->
        hashed_token = :crypto.hash(AuthConfig.get_hash_algorithm(), decoded_token)

        query =
          hashed_token
          |> by_token_and_context_query(context)
          |> where([token], token.inserted_at > ago(^AuthConfig.get_max_age(:change_email, :days), "day"))

        {:ok, query}

      :error ->
        :error
    end
  end

  @doc """
  Returns the token struct for the given token value and context.
  """
  def by_token_and_context_query(token, context) do
    where(UserToken, [t], t.token == ^token and t.context == ^context)
  end

  @doc """
  Gets all tokens for the given user for the given contexts.
  """
  def by_user_and_contexts_query(user, :all) do
    where(UserToken, [t], t.user_id == ^user.id)
  end

  def by_user_and_contexts_query(user, contexts) when is_list(contexts) do
    where(UserToken, [t], t.user_id == ^user.id and t.context in ^contexts)
  end

  @doc """
  Deletes a list of tokens.
  """
  def delete_all_query(tokens) do
    where(UserToken, [t], t.id in ^Enum.map(tokens, & &1.id))
  end
end
