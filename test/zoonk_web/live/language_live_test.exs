defmodule ZoonkWeb.LanguageLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures

  alias Zoonk.Accounts

  describe "update language form" do
    setup :signup_and_login_user

    test "updates user language successfully", %{conn: conn, user: user} do
      conn
      |> visit(~p"/language")
      |> fill_form("#language_form", user: %{language: "pt"})
      |> submit()
      |> assert_has(".alert-info", text: "Language updated successfully.")

      updated_user = Accounts.get_user_by_email(user.email)
      assert updated_user.language == :pt
    end

    test "renders errors with invalid data (phx-change)", %{conn: conn} do
      conn
      |> visit(~p"/language")
      |> fill_form("#language_form", user: %{language: ""})
      |> assert_has("p", text: "can't be blank")
    end

    test "shows current user language as selected", %{conn: conn, user: user} do
      # Update user to Portuguese first
      {:ok, _user} = Accounts.update_user_language(user, %{language: :pt})

      conn
      |> visit(~p"/language")
      |> assert_has("select option[value='pt'][selected]")
    end

    test "form shows all available language options", %{conn: conn} do
      page = 
        conn
        |> visit(~p"/language")

      # Check that some expected languages are available
      page
      |> assert_has("option", text: "English")
      |> assert_has("option", text: "Português")
      |> assert_has("option", text: "Español")
      |> assert_has("option", text: "Français")
    end

    test "rejects invalid language values", %{conn: conn} do
      conn
      |> visit(~p"/language")
      |> fill_form("#language_form", user: %{language: "invalid_lang"})
      |> submit()
      |> assert_has("p", text: "is invalid")
    end
  end
end