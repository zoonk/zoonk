defmodule Zoonk.AccountFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `Zoonk.Accounts` context.
  """

  import Ecto.Query

  alias Zoonk.Accounts
  alias Zoonk.Schemas.UserToken
  alias Zoonk.Scope

  def unique_user_email, do: "user#{System.unique_integer()}@example.com"

  def valid_user_attributes(attrs \\ %{}) do
    Enum.into(attrs, %{
      email: unique_user_email(),
      language: :en
    })
  end

  def unconfirmed_user_fixture(attrs \\ %{}) do
    {:ok, user} =
      attrs
      |> valid_user_attributes()
      |> Accounts.signup_user()

    user
  end

  def user_fixture(attrs \\ %{}) do
    fixture = unconfirmed_user_fixture(attrs)

    token =
      extract_user_token(fn url ->
        Accounts.deliver_login_instructions(fixture, url)
      end)

    {:ok, user, _expired_tokens} = Accounts.login_user_by_magic_link(token)

    user
  end

  def user_scope_fixture do
    user = user_fixture()
    user_scope_fixture(user)
  end

  def user_scope_fixture(user) do
    Scope.for_user(user)
  end

  def extract_user_token(fun) do
    {:ok, captured_email} = fun.(&"[TOKEN]#{&1}[TOKEN]")
    [_str, token | _opts] = String.split(captured_email.text_body, "[TOKEN]")
    token
  end

  def override_token_inserted_at(token, inserted_at) when is_binary(token) do
    UserToken
    |> where([t], t.token == ^token)
    |> Zoonk.Repo.update_all(set: [inserted_at: inserted_at])
  end

  def generate_user_magic_link_token(user) do
    {encoded_token, user_token} = Zoonk.Accounts.TokenBuilder.build_email_token(user, "login")
    Zoonk.Repo.insert!(user_token)
    {encoded_token, user_token.token}
  end

  def oauth_fixture(attrs \\ %{}) do
    %{
      "provider" => Map.get(attrs, :provider, :google),
      "email" => Map.get(attrs, :email, unique_user_email()),
      "name" => Map.get(attrs, :name, nil),
      "preferred_username" => Map.get(attrs, :username, nil),
      "picture" => Map.get(attrs, :picture, "https://zoonk.test/image.png"),
      "sub" => Map.get(attrs, :uid, "1234567890")
    }
  end
end
