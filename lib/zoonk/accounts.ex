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
  alias Zoonk.Accounts.UserInterests
  alias Zoonk.Accounts.UserNotifier
  alias Zoonk.Accounts.UserProfile
  alias Zoonk.Accounts.UserProvider
  alias Zoonk.Accounts.UserToken
  alias Zoonk.Helpers
  alias Zoonk.Orgs.Org
  alias Zoonk.Orgs.OrgMember
  alias Zoonk.Orgs.OrgSettings
  alias Zoonk.Repo
  alias Zoonk.Scope

  @rand_size Application.compile_env!(:zoonk, :user_token)[:rand_size]
  @oauth_providers Application.compile_env(:zoonk, :oauth_providers, [])
  @sudo_mode_max_age_minutes Application.compile_env!(:zoonk, :user_token)[:max_age_minutes][:sudo_mode]

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
  Updates a user profile.

  ## Examples

      iex> update_user_profile(%Scope{}, %UserProfile{}, %{display_name: "New Name"})
      {:ok, %UserProfile{}}

      iex> update_user_profile(%Scope{}, %UserProfile{}, %{display_name: bad_value})
      {:error, %Ecto.Changeset{}}
  """
  def update_user_profile(%Scope{} = scope, %UserProfile{} = profile, attrs) when scope.user.id == profile.user_id do
    profile
    |> change_user_profile(attrs)
    |> Repo.update()
  end

  def update_user_profile(_scope, _user_profile, _attrs) do
    {:error, :unauthorized}
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking a user's settings changes.

  ## Examples

      iex> change_user_settings(%User{}, %{language: :en})
      %Ecto.Changeset{data: %User{}}
  """
  def change_user_settings(%User{} = user, attrs \\ %{}) do
    User.settings_changeset(user, attrs, validate_email: false)
  end

  @doc """
  Updates a user's settings.

  ## Examples

      iex> update_user_settings(%Scope{}, %{language: :en})
      {:ok, %User{}}

      iex> update_user_settings(%Scope{}, %{language: :invalid})
      {:error, %Ecto.Changeset{}}
  """
  def update_user_settings(%Scope{user: user}, attrs) do
    user
    |> change_user_settings(attrs)
    |> Repo.update()
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking a user's interests changes.

  ## Examples

      iex> change_user_interests(%UserInterests{}, %{interests: ["programming", "music"]})
      %Ecto.Changeset{data: %UserInterests{}}
  """
  def change_user_interests(%UserInterests{} = user_interests, attrs \\ %{}) do
    UserInterests.changeset(user_interests, attrs)
  end

  @doc """
  Gets a user's interests record.

  ## Examples

      iex> get_user_interests(%Scope{user: %User{id: 1}})
      %UserInterests{}

      iex> get_user_interests(%Scope{user: %User{id: 999}})
      nil
  """
  def get_user_interests(%Scope{user: user}) do
    Repo.get_by(UserInterests, user_id: user.id)
  end

  @doc """
  Creates or updates a user's interests.

  ## Examples

      iex> upsert_user_interests(%Scope{}, %{interests: ["programming"]})
      {:ok, %UserInterests{}}

      iex> upsert_user_interests(%Scope{}, %{interests: invalid_data})
      {:error, %Ecto.Changeset{}}
  """
  def upsert_user_interests(%Scope{user: user}, attrs) do
    case get_user_interests(%Scope{user: user}) do
      nil ->
        %UserInterests{user_id: user.id}
        |> change_user_interests(attrs)
        |> Repo.insert()

      existing_interests ->
        existing_interests
        |> change_user_interests(attrs)
        |> Repo.update()
    end
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
    opts = [allowed_domains: allowed_domains(scope.org)]
    changeset = User.signup_changeset(%User{}, attrs, opts)

    Ecto.Multi.new()
    |> Ecto.Multi.insert(:user, changeset)
    |> Ecto.Multi.insert(:profile, &build_initial_user_profile/1)
    |> Ecto.Multi.insert(:org_member, &build_org_member_changeset(&1, scope.org))
    |> Repo.transact()
    |> Helpers.changeset_from_transaction(:user)
  end

  # `:app` and `:creator` orgs allow any domains to sign up
  defp allowed_domains(%Org{kind: kind}) when kind in [:app, :creator], do: nil

  # other orgs may require specific domains to sign up
  defp allowed_domains(%Org{id: id}) do
    OrgSettings
    |> Repo.get_by!(org_id: id)
    |> Map.get(:allowed_domains)
  end

  @doc """
  Checks whether the user is in sudo mode.

  The user is in sudo mode when the last authentication was done recently.
  """
  def sudo_mode?(%User{authenticated_at: ts}) when is_struct(ts, DateTime) do
    minutes = @sudo_mode_max_age_minutes
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
  Updates the user email using the given OTP code.

  If the code matches, the user email is updated and the code is deleted.
  """
  def update_user_email(user, otp_code) do
    context = "change:#{user.email}"

    with {:ok, query} <- UserToken.verify_change_email_code_query(otp_code, context),
         %UserToken{sent_to: email} <- Repo.one(query),
         {:ok, _res} <-
           user
           |> user_email_multi(email, context)
           |> Repo.transact() do
      :ok
    else
      _error -> :error
    end
  end

  defp user_email_multi(user, email, context) do
    changeset = User.email_changeset(user, %{email: email})
    confirm = User.confirm_changeset(user)

    Ecto.Multi.new()
    |> Ecto.Multi.update(:user, changeset)
    |> Ecto.Multi.update(:confirm, confirm)
    |> Ecto.Multi.delete_all(:tokens, UserToken.by_user_and_contexts_query(user, [context]))
  end

  @doc """
  Generates a session token.
  """
  def generate_user_session_token(user, opts \\ [decoded: true])

  def generate_user_session_token(user, decoded: true) do
    {token, user_token} = UserToken.build_session_token(user)
    Repo.insert!(user_token)
    token
  end

  def generate_user_session_token(user, decoded: false) do
    decoded_token = generate_user_session_token(user, decoded: true)
    Base.url_encode64(decoded_token, padding: false)
  end

  @doc """
  Gets the user with the given signed token.

  If the token is valid `{user, token_inserted_at}` is returned,
  otherwise `nil` is returned.
  """
  def get_user_by_session_token(<<_b::binary-size(@rand_size)>> = token) do
    {:ok, query} = UserToken.verify_session_token_query(token)

    case Repo.one(query) do
      nil -> nil
      {user, token_inserted_at} -> {Repo.preload(user, :profile), token_inserted_at}
    end
  end

  def get_user_by_session_token(token) when is_binary(token) do
    Helpers.with_decoded_token(token, &get_user_by_session_token/1, nil)
  end

  @doc """
  Logs the user in by OTP code.

  There are three cases to consider:

  1. The user has already confirmed their email. They are logged in
     and the OTP code is expired.

  2. The user has not confirmed their email.
     In this case, the user gets confirmed, logged in, and all tokens -
     including session ones - are expired. In theory, no other tokens
     exist but we delete all of them for best security practices.
  """
  def login_user_by_otp(otp_code, email) do
    {:ok, query} = UserToken.verify_otp_code_query(otp_code, email)

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

      iex> deliver_user_update_email_instructions(user, current_email)
      {:ok, %{to: ..., body: ...}}

      iex> deliver_user_update_email_instructions(user, current_email)
      {:error, :rate_limit_exceeded}

  """
  def deliver_user_update_email_instructions(%User{} = user, current_email) do
    case UserToken.build_otp_code(user, "change:#{current_email}") do
      {:ok, otp_code} ->
        UserNotifier.deliver_update_email_instructions(user, otp_code)

      {:error, :rate_limit_exceeded} = error ->
        error
    end
  end

  @doc ~S"""
  Delivers the OTP code login instructions to the given user.

  ## Examples

      iex> deliver_login_instructions(user)
      {:ok, %{to: ..., body: ...}}

      iex> deliver_login_instructions(user)
      {:error, :rate_limit_exceeded}

  """
  def deliver_login_instructions(%User{} = user) do
    case UserToken.build_otp_code(user, "login") do
      {:ok, otp_code} ->
        UserNotifier.deliver_login_instructions(user, otp_code)

      {:error, :rate_limit_exceeded} = error ->
        error
    end
  end

  @doc """
  Deletes the signed token with the given context.
  """
  def delete_user_session_token(<<_b::binary-size(@rand_size)>> = token) do
    token
    |> UserToken.by_token_and_context_query("session")
    |> Repo.delete_all()

    :ok
  end

  def delete_user_session_token(token) when is_binary(token) do
    Helpers.with_decoded_token(token, &delete_user_session_token/1)
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
           |> Repo.transact() do
      {:ok, user, expired_tokens}
    end
  end

  @doc """
  Returns a list of supported oAuth providers.

  ## Example

      iex> list_providers()
      [:apple, :github, :google]
  """
  def list_providers, do: @oauth_providers

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
    |> user_provider_changeset(provider_attrs(auth))
    |> Repo.insert(on_conflict: :nothing)
  end

  # Create a new user and link the provider
  defp signup_user_with_provider(auth, %Scope{} = scope, language) do
    user_attrs = %{email: auth["email"], language: language}
    provider_attrs = provider_attrs(auth)
    profile_opts = [display_name: auth["name"], picture_url: auth["picture"], username: auth["preferred_username"]]

    user_changeset =
      %User{}
      |> User.signup_changeset(user_attrs, allowed_domains: allowed_domains(scope.org))
      |> User.confirm_changeset()

    Ecto.Multi.new()
    |> Ecto.Multi.insert(:user, user_changeset)
    |> Ecto.Multi.insert(:profile, &build_initial_user_profile(&1, profile_opts))
    |> Ecto.Multi.insert(:provider, &user_provider_changeset(&1, provider_attrs))
    |> Ecto.Multi.insert(:org_member, &build_org_member_changeset(&1, scope.org))
    |> Repo.transact()
    |> Helpers.changeset_from_transaction(:user)
  end

  defp user_provider_changeset(%{user: %User{} = user}, provider_attrs) do
    UserProvider.changeset(%UserProvider{user_id: user.id}, provider_attrs)
  end

  defp provider_attrs(auth) do
    %{provider: auth["provider"], provider_uid: to_string(auth["sub"])}
  end

  defp build_initial_user_profile(%{user: %User{id: user_id, email: email}}, opts \\ []) do
    %UserProfile{
      display_name: opts[:display_name],
      picture_url: opts[:picture_url],
      username: username_from_email(opts[:username] || email),
      user_id: user_id
    }
  end

  defp username_from_email(email) do
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
    OrgMember.changeset(%OrgMember{org_id: org.id, user_id: user.id}, %{role: :member})
  end
end
