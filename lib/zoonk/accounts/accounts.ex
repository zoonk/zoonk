defmodule Zoonk.Accounts do
  @moduledoc """
  Manages user accounts.

  This module handles core account management flows including user signup,
  session management, and email verification.

  It coordinates with the database layer to manage user records and tokens,
  while enforcing security measures like sudo mode and token expiration.
  """
  import Ecto.Query, warn: false

  alias Zoonk.Accounts.TokenBuilder
  alias Zoonk.Accounts.UserNotifier
  alias Zoonk.Accounts.UserProfileBuilder
  alias Zoonk.Configuration
  alias Zoonk.Helpers
  alias Zoonk.Queries
  alias Zoonk.Repo
  alias Zoonk.Schemas.User
  alias Zoonk.Schemas.UserIdentity
  alias Zoonk.Schemas.UserToken

  @doc """
  Gets a user entity by email.

  ## Examples

      iex> get_user_identity_by_email("foo@example.com")
      %UserIdentity{}

      iex> get_user_identity_by_email("unknown@example.com")
      nil
  """
  def get_user_identity_by_email(email) when is_binary(email) do
    Repo.get_by(UserIdentity, identity_id: email)
  end

  ## User signup

  @doc """
  Signs up a user.

  ## Examples

      iex> signup_user_with_email(%{field: value})
      {:ok, %{user: user, user_identity: user_identity, user_profile: user_profile}}

      iex> signup_user_with_email(%{field: bad_value})
      {:error, :user_identity, changeset, _data}

  """
  def signup_user_with_email(attrs) do
    attrs =
      attrs
      |> Helpers.normalize_keys()
      |> Map.merge(%{provider: :email, is_primary: true})

    Ecto.Multi.new()
    |> Ecto.Multi.insert(:user, User.changeset(%User{}, attrs))
    |> Ecto.Multi.insert(:user_identity, &user_identity_changeset(&1, attrs))
    |> Ecto.Multi.insert(:user_profile, &UserProfileBuilder.build_initial_user_profile/1)
    |> Repo.transaction()
  end

  ## Settings

  @doc """
  Checks whether the user is in sudo mode.

  The user is in sudo mode when the last authentication was done recently.
  """
  def sudo_mode?(%UserIdentity{authenticated_at: ts}) when is_struct(ts, DateTime) do
    minutes = Configuration.get_max_age(:sudo_mode, :minutes)
    DateTime.after?(ts, DateTime.add(DateTime.utc_now(), minutes, :minute))
  end

  def sudo_mode?(_user), do: false

  @doc """
  Returns an `%Ecto.Changeset{}` for changing the user identity.

  ## Examples

      iex> change_user_identity(%UserIdentity{}, %{})
      %Ecto.Changeset{data: %UserIdentity{}}

  """
  def change_user_identity(%UserIdentity{} = user_identity, attrs \\ %{}) do
    UserIdentity.changeset(user_identity, attrs)
  end

  @doc """
  Updates the user identity email using the given token.

  If the token matches, the user email is updated and the token is deleted.
  """
  def update_user_email(%UserIdentity{} = user_identity, token) do
    context = "change:#{user_identity.identity_id}"

    with {:ok, query} <- Queries.UserToken.verify_change_email_token(token, context),
         %UserToken{sent_to: email} <- Repo.one(query),
         {:ok, _res} <-
           user_identity
           |> user_email_multi(email, context)
           |> Repo.transaction() do
      :ok
    else
      _error -> :error
    end
  end

  defp user_email_multi(%UserIdentity{} = user_identity, email, context) do
    changeset = UserIdentity.changeset(user_identity, %{identity_id: email})

    Ecto.Multi.new()
    |> Ecto.Multi.update(:user_identity, changeset)
    |> Ecto.Multi.delete_all(:tokens, Queries.UserToken.by_user_and_contexts(user_identity, [context]))
  end

  ## Session
  @doc """
  Generates a session token.

  ## Examples

      iex> generate_user_session_token(%UserIdentity{})
      <<...>>
  """
  def generate_user_session_token(%UserIdentity{} = user_identity) do
    {token, user_token} = TokenBuilder.build_session_token(user_identity)
    Repo.insert!(user_token)
    token
  end

  @doc """
  Gets the user identity with the given signed token.

  ## Examples

      iex> get_user_identity_by_session_token(token)
      %UserIdentity{}

      iex> get_user_identity_by_session_token(token)
      nil
  """
  def get_user_identity_by_session_token(token) do
    {:ok, query} = Queries.UserToken.verify_session_token(token)

    query
    |> Repo.one()
    |> Repo.preload(user: :profile)
  end

  @doc """
  Gets the user identity with the given magic link token.

  ## Examples

      iex> get_user_identity_by_magic_link_token(token)
      %UserIdentity{}

      iex> get_user_identity_by_magic_link_token(token)
      nil
  """
  def get_user_identity_by_magic_link_token(token) do
    with {:ok, query} <- Queries.UserToken.verify_magic_link_token(token),
         {user_identity, _token} <- Repo.one(query) do
      user_identity
    else
      _error -> nil
    end
  end

  @doc """
  Logs the user in by magic link.

  There are three cases to consider:

  1. The user has already confirmed their email. They are logged in
     and the magic link is expired.

  2. The user has not confirmed their email.
     In this case, the user gets confirmed, logged in, and all tokens -
     including session ones - are expired. In theory, no other tokens
     exist but we delete all of them for best security practices.

  ## Examples

      iex> login_user_by_magic_link(token)
      {:ok, %UserIdentity{}, []}

      iex> login_user_by_magic_link(token)
      {:ok, %UserIdentity{}, [%UserToken{}]}

      iex> login_user_by_magic_link(token)
      {:error, :not_found}
  """
  def login_user_by_magic_link(token) do
    {:ok, query} = Queries.UserToken.verify_magic_link_token(token)

    case Repo.one(query) do
      {%UserIdentity{confirmed_at: nil} = user_identity, _token} ->
        user_identity
        |> UserIdentity.confirm_changeset()
        |> update_user_and_delete_all_tokens()

      {%UserIdentity{} = user_identity, token} ->
        Repo.delete!(token)
        {:ok, user_identity, []}

      nil ->
        {:error, :not_found}
    end
  end

  @doc ~S"""
  Delivers the update email instructions to the given user identity.

  ## Examples

      iex> deliver_user_update_email_instructions(user_identity, current_email, &url(~p"/user/email/confirm/#{&1}"))
      {:ok, %{to: ..., body: ...}}

  """
  def deliver_user_update_email_instructions(%UserIdentity{} = user_identity, current_email, update_email_url_fun)
      when is_function(update_email_url_fun, 1) do
    {encoded_token, user_token} = TokenBuilder.build_email_token(user_identity, "change:#{current_email}")
    Repo.insert!(user_token)
    UserNotifier.deliver_update_email_instructions(user_identity, update_email_url_fun.(encoded_token))
  end

  @doc ~S"""
  Delivers the magic link login instructions to the given user identity.
  """
  def deliver_login_instructions(%UserIdentity{} = user_identity, magic_link_url_fun)
      when is_function(magic_link_url_fun, 1) do
    {encoded_token, user_token} = TokenBuilder.build_email_token(user_identity, "login")
    Repo.insert!(user_token)
    UserNotifier.deliver_login_instructions(user_identity, magic_link_url_fun.(encoded_token))
  end

  @doc """
  Deletes the signed token with the given context.
  """
  def delete_user_session_token(token) do
    token
    |> Queries.UserToken.by_token_and_context("session")
    |> Repo.delete_all()

    :ok
  end

  @doc """
  Deletes an email identity.
  """
  def delete_user_identity(%UserIdentity{is_primary: true, confirmed_at: %DateTime{}}) do
    {:error, :forbidden}
  end

  def delete_user_identity(%UserIdentity{} = user_identity) do
    Ecto.Multi.new()
    |> Ecto.Multi.delete(:user_identity, user_identity)
    |> Ecto.Multi.delete_all(:tokens, Queries.UserToken.by_user_and_contexts(user_identity, :all))
    |> Repo.transaction()
    |> Helpers.EctoUtils.get_changeset_from_transaction(:user_identity)
  end

  ## Token helper

  defp update_user_and_delete_all_tokens(changeset) do
    %{data: %UserIdentity{} = user_identity} = changeset

    with {:ok, %{user_identity: user_identity, tokens_to_expire: expired_tokens}} <-
           Ecto.Multi.new()
           |> Ecto.Multi.update(:user_identity, changeset)
           |> Ecto.Multi.all(:tokens_to_expire, Queries.UserToken.by_user_and_contexts(user_identity, :all))
           |> Ecto.Multi.delete_all(:tokens, fn %{tokens_to_expire: tokens_to_expire} ->
             Queries.UserToken.delete_all(tokens_to_expire)
           end)
           |> Repo.transaction() do
      {:ok, user_identity, expired_tokens}
    end
  end

  @doc """
  Signs in a user with a third-party account.

  It either links the account to an existing user
  or signs up a new user and links the external identity.

  ## Examples

      iex> login_with_external_account(%{}, "en")
      {:ok, %UserIdentity{}}

      iex> login_with_external_account(nil, "en")
      {:error, %Ecto.Changeset{}}
  """
  def login_with_external_account(oauth, language) do
    user_identity = get_user_identity_by_external_account(oauth)
    login_with_external_account(oauth, language, user_identity)
  end

  # link the external account to an existing user
  defp login_with_external_account(oauth, _lang, %UserIdentity{provider: :email} = user_identity) do
    %{user_identity: user_identity}
    |> user_identity_changeset(get_identity_attrs(oauth))
    |> Repo.insert()
  end

  # if the account is already linked, check if the email stays the same
  # if the email is different, we may need to add it to user identities
  defp login_with_external_account(oauth, _lang, %UserIdentity{} = external_identity) do
    email_identity = get_user_identity_by_email(oauth["email"])
    maybe_add_email(email_identity, external_identity, oauth)
  end

  # Create a new user if it doesn't exist
  defp login_with_external_account(auth, language, nil) do
    signup_user_with_external_account(auth, language)
  end

  # don't add if the email stays the same and belongs to the same user
  defp maybe_add_email(email_identity, external_identity, _oauth)
       when email_identity.user_id == external_identity.user_id do
    {:ok, external_identity}
  end

  # in some cases, another user may have added this email but
  # they didn't confirm it because they don't own it
  # in that case, we remove the unconfirmed identity from the other user
  # and add the new email to this user's identities
  defp maybe_add_email(email_identity, external_identity, oauth)
       when email_identity.user_id != external_identity.user_id and is_nil(email_identity.confirmed_at) do
    case delete_user_identity(email_identity) do
      {:ok, _changeset} ->
        %{user_identity: external_identity}
        |> user_identity_changeset(get_identity_attrs(oauth, :email, primary?: false))
        |> Repo.insert()

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  # in some cases, this user may have previously created
  # and confirmed it with this email address.
  # To prevent conflicts, we keep their confirmed email
  # identity but update the external identity association
  # to the same user as the email identity.
  defp maybe_add_email(email_identity, external_identity, _oauth)
       when email_identity.user_id != external_identity.user_id and email_identity.confirmed_at != nil do
    external_identity
    |> UserIdentity.changeset(%{user_id: email_identity.user_id})
    |> Repo.update()
  end

  # lastly, if the user doesn't have an email identity
  # for this external account, we create one
  defp maybe_add_email(nil, external_identity, oauth) do
    %{user_identity: external_identity}
    |> user_identity_changeset(get_identity_attrs(oauth, :email, primary?: false))
    |> Repo.insert()
  end

  # Create a new user and link the external account
  # when signing up with an external, we create two identities:
  # one for the external account and one for the email address
  # the email one is marked as primary
  # we don't store the email address in the external account
  # only the identity ID because this allows us to keep
  # the link even if the user changes their email address
  # in the external provider.
  defp signup_user_with_external_account(auth, language) do
    profile_opts = [display_name: auth["name"], picture_url: auth["picture"], username: auth["preferred_username"]]

    Ecto.Multi.new()
    |> Ecto.Multi.insert(:user, User.changeset(%User{}, %{language: language}))
    |> Ecto.Multi.insert(:user_identity, &user_identity_changeset(&1, get_identity_attrs(auth, :email)))
    |> Ecto.Multi.insert(:profile, &UserProfileBuilder.build_initial_user_profile(&1, profile_opts))
    |> Ecto.Multi.insert(:external_identity, &user_identity_changeset(&1, get_identity_attrs(auth)))
    |> Repo.transaction()
    |> Helpers.EctoUtils.get_changeset_from_transaction(:user_identity)
  end

  defp user_identity_changeset(%{user: %User{} = user}, identity_attrs) do
    %UserIdentity{user_id: user.id}
    |> UserIdentity.changeset(identity_attrs)
    |> maybe_confirm_user(identity_attrs)
  end

  defp user_identity_changeset(%{user_identity: %UserIdentity{} = user_identity}, identity_attrs) do
    %UserIdentity{user_id: user_identity.user_id}
    |> UserIdentity.changeset(identity_attrs)
    |> maybe_confirm_user(identity_attrs)
  end

  # when signing up with an external account, we can confirm the user without sending a magic link
  defp maybe_confirm_user(changeset, %{confirmed?: true}), do: UserIdentity.confirm_changeset(changeset)
  defp maybe_confirm_user(changeset, _attrs), do: changeset

  # when using an external account, we use `confirmed?: true`
  # to mark the identity as confirmed since the external provider
  # already confirmed the user, so we don't need to send a magic link
  defp get_identity_attrs(external_account) do
    %{provider: external_account["provider"], identity_id: to_string(external_account["sub"]), confirmed?: true}
  end

  defp get_identity_attrs(external_account, :email, opts \\ []) do
    primary? = Keyword.get(opts, :primary?, true)
    %{provider: :email, identity_id: to_string(external_account["email"]), is_primary: primary?, confirmed?: true}
  end

  # first check if this user already created an account with this provider
  # if so, we return the user identity. this is important because the user
  # may have changed their email address in the external provider
  # otherwise, we check if the user already exists with the same email
  defp get_user_identity_by_external_account(external_account) do
    provider_opts = [identity_id: to_string(external_account["sub"]), provider: external_account["provider"]]

    UserIdentity
    |> Repo.get_by(provider_opts)
    |> get_user_identity_by_external_account(external_account)
  end

  defp get_user_identity_by_external_account(%UserIdentity{} = user_identity, _external), do: user_identity
  defp get_user_identity_by_external_account(nil, external), do: get_user_identity_by_email(external["email"])
end
