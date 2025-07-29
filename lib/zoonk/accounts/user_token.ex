defmodule Zoonk.Accounts.UserToken do
  @moduledoc """
  Represents authentication and verification tokens for users.

  We send an OTP code to users when they login, sign up, or change their email.
  They can use this code to verify their identity and
  generate a session token used for authentication.

  ## Fields

  | Field Name   | Type      | Description                                       |
  |--------------|-----------|---------------------------------------------------|
  | `token`      | `Binary`  | The token used for authentication or verification.|
  | `context`    | `String`  | The context in which the token is used (e.g., "login"). |
  | `sent_to`    | `String`  | The email address or phone number to which the token was sent. |
  | `user_id`    | `Integer` | The ID from `Zoonk.Accounts.User`.                |
  | `inserted_at`| `DateTime`| Timestamp when the token was created.             |
  | `updated_at` | `DateTime`| Timestamp when the token was last updated.        |
  """
  use Ecto.Schema

  import Ecto.Query

  alias Zoonk.Accounts.UserToken
  alias Zoonk.Repo

  @rand_size Application.compile_env!(:zoonk, :user_token)[:rand_size]
  @hash_algorithm :sha256
  @session_validity_in_days Application.compile_env!(:zoonk, :user_token)[:max_age_days][:session]
  @otp_validity_in_minutes Application.compile_env!(:zoonk, :user_token)[:max_age_minutes][:otp]
  @change_email_validity_in_days Application.compile_env!(:zoonk, :user_token)[:max_age_days][:change_email]

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
    query =
      token
      |> by_token_and_context_query("session")
      |> join(:inner, [token], user in assoc(token, :user))
      |> where([token, user], token.inserted_at > ago(^@session_validity_in_days, "day"))
      |> select([token, user], {%{user | authenticated_at: token.authenticated_at}, token.inserted_at})

    {:ok, query}
  end

  @doc """
  Builds an OTP code and its hash to be delivered to the user's email.

  The non-hashed OTP code is sent to the user email while the
  hashed part is stored in the database. The original code cannot be reconstructed,
  which means anyone with read-only access to the database cannot directly use
  the code in the application to gain access. Furthermore, if the user changes
  their email in the system, the codes sent to the previous email are no longer
  valid.

  Returns `{:ok, otp_code}` if the code can be generated,
  or `{:error, :rate_limit_exceeded}` if the user has exceeded the maximum
  number of OTP codes allowed per hour.
  """
  def build_otp_code(user, context) do
    if can_send_code?(user, context) do
      otp_code =
        100_000..999_999
        |> Enum.random()
        |> Integer.to_string()

      hashed_token = :crypto.hash(@hash_algorithm, otp_code)

      Repo.insert!(%UserToken{
        token: hashed_token,
        context: context,
        sent_to: user.email,
        user_id: user.id
      })

      {:ok, otp_code}
    else
      {:error, :rate_limit_exceeded}
    end
  end

  @doc """
  Checks if the OTP code is valid and returns its underlying lookup query.

  If found, the query returns a tuple of the form `{user, token}`.

  The given code is valid if it matches its hashed counterpart in the
  database. This function also checks if the code is being used within
  15 minutes. The context of an OTP code is always "login".
  """
  def verify_otp_code_query(otp_code, email) do
    hashed_otp = :crypto.hash(@hash_algorithm, otp_code)

    query =
      hashed_otp
      |> by_token_and_context_query("login")
      |> join(:inner, [token], user in assoc(token, :user))
      |> where([token], token.inserted_at > ago(^@otp_validity_in_minutes, "minute"))
      |> where([token, user], token.sent_to == ^email)
      |> where([token, user], token.sent_to == user.email)
      |> select([token, user], {user, token})

    {:ok, query}
  rescue
    _error -> :error
  end

  @doc """
  Checks if the OTP code is valid and returns its underlying lookup query.

  The query returns the user_token found by the token, if any.

  This is used to validate requests to change the user email.
  The given OTP code is valid if it matches its hashed counterpart in the
  database and if it has not expired.
  The context must always start with "change:".
  """
  def verify_change_email_code_query(otp_code, "change:" <> _rest = context) do
    hashed_otp = :crypto.hash(@hash_algorithm, otp_code)

    query =
      hashed_otp
      |> by_token_and_context_query(context)
      |> where([token], token.inserted_at > ago(^@change_email_validity_in_days, "day"))

    {:ok, query}
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

  # Private functions

  @doc false
  defp can_send_code?(user, context) do
    one_hour_ago = DateTime.add(DateTime.utc_now(), -1, :hour)

    UserToken
    |> where([t], t.user_id == ^user.id and t.context == ^context)
    |> where([t], t.inserted_at >= ^one_hour_ago)
    |> Repo.aggregate(:count)
    |> Kernel.<(get_max_otp_codes_per_hour())
  end

  @doc """
  Returns the maximum number of OTP codes that can be issued per hour.

  The purpose of this rate limit is to prevent brute force attacks
  and protect users from excessive OTP code attempts.

  ## Example

      iex> get_max_otp_codes_per_hour()
      5
  """
  def get_max_otp_codes_per_hour, do: 5
end
