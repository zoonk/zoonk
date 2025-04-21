defmodule Zoonk.Accounts do
  @moduledoc """
  Manages user accounts.

  This module handles core account management flows including user signup,
  session management, and email verification.

  It coordinates with the database layer to manage user records and tokens,
  while enforcing security measures like sudo mode and token expiration.
  """
  import Ecto.Query, warn: false

  alias Zoonk.Accounts.User
  alias Zoonk.Accounts.UserNotifier
  alias Zoonk.Accounts.UserProfile
  alias Zoonk.Accounts.UserProvider
  alias Zoonk.Accounts.UserToken
  alias Zoonk.Config.AuthConfig
  alias Zoonk.Helpers
  alias Zoonk.Orgs.Org
  alias Zoonk.Orgs.OrgMember
  alias Zoonk.Orgs.OrgSettings
  alias Zoonk.Repo
  alias Zoonk.Scope

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking a user's profile changes.

  ## Examples

      iex> change_user_profile(%UserProfile{}, %{field: new_value})
      %Ecto.Changeset{data: %UserProfile{}}
  """
  def change_user_profile(%UserProfile{} = user_profile, attrs \\ %{}) do
    UserProfile.changeset(user_profile, attrs)
  end

  @doc """
  Gets a user by email.

  ## Examples

      iex> get_user_by_email("foo@example.com")
      %User{}

      iex> get_user_by_email("unknown@example.com")
      nil

  """
  def get_user_by_email(email) when is_binary(email) do
    Repo.get_by(User, email: email)
  end

  @doc """
  Signs up a user.

  ## Examples

      iex> signup_user(%{field: value}, %Scope{})
      {:ok, %User{}}

      iex> signup_user(%{field: bad_value}, %Scope{})
      {:error, %Ecto.Changeset{}}

      iex> signup_user(%{field: value}, nil)
      {:error, :not_allowed}

  """
  def signup_user(attrs, %Scope{} = scope) do
    opts = [allowed_domains: get_allowed_domains(scope.org)]
    changeset = User.signup_changeset(%User{}, attrs, opts)

    Ecto.Multi.new()
    |> Ecto.Multi.insert(:user, changeset)
    |> Ecto.Multi.insert(:profile, &build_initial_user_profile/1)
    |> Ecto.Multi.insert(:org_member, &build_org_member_changeset(&1, scope.org))
    |> Repo.transaction()
    |> Helpers.get_changeset_from_transaction(:user)
  end

  # `:app` and `:creator` orgs allow any domains to sign up
  defp get_allowed_domains(%Org{kind: kind}) when kind in [:app, :creator], do: nil

  # other orgs may require specific domains to sign up
  defp get_allowed_domains(%Org{id: id}) do
    OrgSettings
    |> Repo.get_by!(org_id: id)
    |> Map.get(:allowed_domains)
  end

  @doc """
  Creates a guest user.

  ## Examples

      iex> create_guest_user(%{}, %Scope{})
      {:ok, %User{}}

  """
  def create_guest_user(attrs, %Scope{org: org}) when org.kind == :app do
    email = "guest_#{System.unique_integer([:positive])}@zoonk.dev"
    user = %User{email: email, language: String.to_existing_atom(attrs.language)}

    Ecto.Multi.new()
    |> Ecto.Multi.insert(:user, user)
    |> Ecto.Multi.insert(:profile, &build_initial_user_profile/1)
    |> Ecto.Multi.insert(:org_member, &build_org_member_changeset(&1, org))
    |> Repo.transaction()
    |> Helpers.get_changeset_from_transaction(:user)
  end

  # Don't create guest users for other orgs
  def create_guest_user(_attrs, _scope), do: nil

  @doc """
  Checks whether the user is in sudo mode.

  The user is in sudo mode when the last authentication was done recently.
  """
  def sudo_mode?(%User{authenticated_at: ts}) when is_struct(ts, DateTime) do
    minutes = AuthConfig.get_max_age(:sudo_mode, :minutes)
    DateTime.after?(ts, DateTime.add(DateTime.utc_now(), minutes, :minute))
  end

  def sudo_mode?(_user), do: false

  @doc """
  Returns an `%Ecto.Changeset{}` for changing the user email.

  See `Zoonk.Accounts.User.email_changeset/3` for a list of supported options.

  ## Examples

      iex> change_user_email(user)
      %Ecto.Changeset{data: %User{}}

  """
  def change_user_email(user, attrs \\ %{}, opts \\ []) do
    User.email_changeset(user, attrs, opts)
  end

  @doc """
  Updates the user email using the given token.

  If the token matches, the user email is updated and the token is deleted.
  """
  def update_user_email(user, token) do
    context = "change:#{user.email}"

    with {:ok, query} <- UserToken.verify_change_email_token_query(token, context),
         %UserToken{sent_to: email} <- Repo.one(query),
         {:ok, _res} <-
           user
           |> user_email_multi(email, context)
           |> Repo.transaction() do
      :ok
    else
      _error -> :error
    end
  end

  defp user_email_multi(user, email, context) do
    changeset = User.email_changeset(user, %{email: email})

    Ecto.Multi.new()
    |> Ecto.Multi.update(:user, changeset)
    |> Ecto.Multi.delete_all(:tokens, UserToken.by_user_and_contexts_query(user, [context]))
  end

  @doc """
  Generates a session token.
  """
  def generate_user_session_token(user) do
    {token, user_token} = UserToken.build_session_token(user)
    Repo.insert!(user_token)
    token
  end

  @doc """
  Gets the user with the given signed token.

  If the token is valid `{user, token_inserted_at}` is returned,
  otherwise `nil` is returned.
  """
  def get_user_by_session_token(token) do
    {:ok, query} = UserToken.verify_session_token_query(token)

    case Repo.one(query) do
      nil -> nil
      {user, token_inserted_at} -> {Repo.preload(user, :profile), token_inserted_at}
    end
  end

  @doc """
  Gets the user with the given magic link token.
  """
  def get_user_by_magic_link_token(token) do
    with {:ok, query} <- UserToken.verify_magic_link_token_query(token),
         {user, _token} <- Repo.one(query) do
      user
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
  """
  def login_user_by_magic_link(token) do
    {:ok, query} = UserToken.verify_magic_link_token_query(token)

    case Repo.one(query) do
      {%User{confirmed_at: nil} = user, _token} ->
        user
        |> User.confirm_changeset()
        |> update_user_and_delete_all_tokens()

      {user, token} ->
        Repo.delete!(token)
        {:ok, user, []}

      nil ->
        {:error, :not_found}
    end
  end

  @doc ~S"""
  Delivers the update email instructions to the given user.

  ## Examples

      iex> deliver_user_update_email_instructions(user, current_email, &url(~p"/user/email/confirm/#{&1}"))
      {:ok, %{to: ..., body: ...}}

  """
  def deliver_user_update_email_instructions(%User{} = user, current_email, update_email_url_fun)
      when is_function(update_email_url_fun, 1) do
    {encoded_token, user_token} = UserToken.build_email_token(user, "change:#{current_email}")

    Repo.insert!(user_token)
    UserNotifier.deliver_update_email_instructions(user, update_email_url_fun.(encoded_token))
  end

  @doc ~S"""
  Delivers the magic link login instructions to the given user.
  """
  def deliver_login_instructions(%User{} = user, magic_link_url_fun) when is_function(magic_link_url_fun, 1) do
    {encoded_token, user_token} = UserToken.build_email_token(user, "login")
    Repo.insert!(user_token)
    UserNotifier.deliver_login_instructions(user, magic_link_url_fun.(encoded_token))
  end

  @doc """
  Deletes the signed token with the given context.
  """
  def delete_user_session_token(token) do
    token
    |> UserToken.by_token_and_context_query("session")
    |> Repo.delete_all()

    :ok
  end

  defp update_user_and_delete_all_tokens(changeset) do
    %{data: %User{} = user} = changeset

    with {:ok, %{user: user, tokens_to_expire: expired_tokens}} <-
           Ecto.Multi.new()
           |> Ecto.Multi.update(:user, changeset)
           |> Ecto.Multi.all(:tokens_to_expire, UserToken.by_user_and_contexts_query(user, :all))
           |> Ecto.Multi.delete_all(:tokens, fn %{tokens_to_expire: tokens_to_expire} ->
             UserToken.delete_all_query(tokens_to_expire)
           end)
           |> Repo.transaction() do
      {:ok, user, expired_tokens}
    end
  end

  @doc """
  Signs in a user with a third-party provider.

  It either links the provider to an existing user
  or signs up a new user and links the provider.

  ## Examples

      iex> login_with_provider(%{}, %Scope{}, "en")
      {:ok, %User{}}

      iex> login_with_provider(nil, %Scope{}, "en")
      {:error, %Ecto.Changeset{}}
  """
  def login_with_provider(auth, %Scope{} = scope, language) do
    user = get_user_by_email(auth["email"])

    case login_with_provider(auth, scope, language, user) do
      {:ok, %User{} = new_user} -> {:ok, new_user}
      {:ok, %UserProvider{}} -> {:ok, user}
      {:error, changeset} -> {:error, changeset}
    end
  end

  # Create a new user if it doesn't exist
  defp login_with_provider(auth, %Scope{} = scope, language, nil) do
    signup_user_with_provider(auth, scope, language)
  end

  # If the user exists, then link the provider
  defp login_with_provider(auth, _scope, _lang, %User{} = user) do
    %{user: user}
    |> user_provider_changeset(get_provider_attrs(auth))
    |> Repo.insert(on_conflict: :nothing)
  end

  # Create a new user and link the provider
  defp signup_user_with_provider(auth, %Scope{} = scope, language) do
    user_attrs = %{email: auth["email"], language: language}
    provider_attrs = get_provider_attrs(auth)
    profile_opts = [display_name: auth["name"], picture_url: auth["picture"], username: auth["preferred_username"]]
    allowed_domains = get_allowed_domains(scope.org)

    user_changeset =
      %User{}
      |> User.signup_changeset(user_attrs, allowed_domains: allowed_domains)
      |> User.confirm_changeset()

    Ecto.Multi.new()
    |> Ecto.Multi.insert(:user, user_changeset)
    |> Ecto.Multi.insert(:profile, &build_initial_user_profile(&1, profile_opts))
    |> Ecto.Multi.insert(:provider, &user_provider_changeset(&1, provider_attrs))
    |> Ecto.Multi.insert(:org_member, &build_org_member_changeset(&1, scope.org))
    |> Repo.transaction()
    |> Helpers.get_changeset_from_transaction(:user)
  end

  defp user_provider_changeset(%{user: %User{} = user}, provider_attrs) do
    UserProvider.changeset(%UserProvider{user_id: user.id}, provider_attrs)
  end

  defp get_provider_attrs(auth) do
    %{provider: auth["provider"], provider_uid: to_string(auth["sub"])}
  end

  defp build_initial_user_profile(%{user: %User{id: user_id, email: email}}, opts \\ []) do
    %UserProfile{
      display_name: opts[:display_name],
      picture_url: opts[:picture_url],
      username: get_username_from_email(opts[:username] || email),
      user_id: user_id
    }
  end

  defp get_username_from_email(email) do
    username =
      email
      |> String.split("@")
      |> List.first()

    available? = username_available?(username)
    build_initial_username(username, available?)
  end

  # If the username is already taken, we append a unique integer to it.
  defp build_initial_username(username, true), do: username
  defp build_initial_username(username, false), do: "#{username}_#{System.unique_integer([:positive])}"

  defp username_available?(username) do
    UserProfile
    |> where([p], p.username == ^username)
    |> Repo.exists?()
    |> Kernel.not()
  end

  defp build_org_member_changeset(%{user: user}, org) do
    OrgMember.changeset(%OrgMember{}, %{
      org_id: org.id,
      user_id: user.id,
      role: :member
    })
  end
end
