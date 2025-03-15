defmodule Zoonk.Accounts.TokenBuilder do
  @moduledoc """
  Handles the generation of authentication tokens.

  It can be used in different contexts, such as sessions
  and email-based authentication.
  """
  alias Zoonk.Configuration
  alias Zoonk.Schemas.UserIdentity
  alias Zoonk.Schemas.UserToken

  @rand_size 32

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

  ## Examples

      iex> build_session_token(%UserIdentity{id: 1})
      {<<...>>, %UserToken{token: <<...>>, context: "session", user_identity_id: 1}}

  """
  def build_session_token(%UserIdentity{} = user_identity) do
    token = :crypto.strong_rand_bytes(@rand_size)
    {token, %UserToken{token: token, context: "session", user_identity_id: user_identity.id}}
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
  def build_email_token(%UserIdentity{} = user_identity, context) do
    build_hashed_token(user_identity, context, user_identity.identity_id)
  end

  defp build_hashed_token(%UserIdentity{} = user_identity, context, sent_to) do
    token = :crypto.strong_rand_bytes(@rand_size)
    hashed_token = :crypto.hash(Configuration.get_hash_algorithm(), token)

    {Base.url_encode64(token, padding: false),
     %UserToken{
       token: hashed_token,
       context: context,
       sent_to: sent_to,
       user_identity_id: user_identity.id
     }}
  end
end
