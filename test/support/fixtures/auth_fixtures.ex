defmodule Zoonk.AuthFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `Zoonk.Auth` context.
  """

  import Ecto.Query

  alias Zoonk.Auth

  def unique_user_email, do: "user#{System.unique_integer()}@example.com"

  def valid_user_attributes(attrs \\ %{}) do
    Enum.into(attrs, %{
      email: unique_user_email()
    })
  end

  def unconfirmed_user_fixture(attrs \\ %{}) do
    {:ok, user} =
      attrs
      |> valid_user_attributes()
      |> Auth.register_user()

    user
  end

  def user_fixture(attrs \\ %{}) do
    fixture = unconfirmed_user_fixture(attrs)

    token =
      extract_user_token(fn url ->
        Auth.deliver_login_instructions(fixture, url)
      end)

    {:ok, user, _expired_tokens} = Auth.login_user_by_magic_link(token)

    user
  end

  def extract_user_token(fun) do
    {:ok, captured_email} = fun.(&"[TOKEN]#{&1}[TOKEN]")
    [_str, token | _opts] = String.split(captured_email.text_body, "[TOKEN]")
    token
  end

  def override_token_inserted_at(token, inserted_at) when is_binary(token) do
    Auth.UserToken
    |> where([t], t.token == ^token)
    |> Zoonk.Repo.update_all(set: [inserted_at: inserted_at])
  end

  def generate_user_magic_link_token(user) do
    {encoded_token, user_token} = Auth.UserToken.build_email_token(user, "login")
    Zoonk.Repo.insert!(user_token)
    {encoded_token, user_token.token}
  end
end
