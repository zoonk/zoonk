defmodule Zoonk.AccountsFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `Zoonk.Accounts` context.
  """

  def unique_user_email, do: "user#{System.unique_integer()}@example.com"
  def unique_user_username, do: "user#{System.unique_integer()}"
  def valid_user_date_of_birth, do: "1989-12-24"
  def valid_user_password, do: "User1234"
  def valid_user_language, do: Zoonk.Language.supported_languages_keys() |> hd()

  @doc """
  Get a user with valid attributes.
  """
  def valid_user_attributes(attrs \\ %{}) do
    Enum.into(attrs, %{
      first_name: "Marie",
      last_name: "Curie",
      email: unique_user_email(),
      username: unique_user_username(),
      date_of_birth: valid_user_date_of_birth(),
      language: valid_user_language(),
      password: valid_user_password()
    })
  end

  @doc """
  Create a valid user and register it in the database.
  """
  def user_fixture(attrs \\ %{}) do
    {:ok, user} =
      attrs
      |> valid_user_attributes()
      |> Zoonk.Accounts.register_user()

    user
  end

  def extract_user_token(fun) do
    {:ok, captured_email} = fun.(&"[TOKEN]#{&1}[TOKEN]")
    [_, token | _] = String.split(captured_email.text_body, "[TOKEN]")
    token
  end
end
