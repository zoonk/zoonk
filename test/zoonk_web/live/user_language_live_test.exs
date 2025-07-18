defmodule ZoonkWeb.UserLanguageLiveTest do
  use ZoonkWeb.ConnCase, async: true

  alias Zoonk.Accounts

  describe "update language form" do
    setup :signup_and_login_user

    test "updates to different languages successfully", %{conn: conn, user: user} do
      # Test French
      conn
      |> visit(~p"/language")
      |> select("Language", option: "Français")
      |> submit()
      |> assert_path(~p"/language")
      |> assert_has("select[name='user[language]'] option[value='fr'][selected]")

      assert Accounts.get_user_by_email(user.email).language == :fr

      # Test Japanese
      conn
      |> visit(~p"/language")
      |> select("Language", option: "日本語")
      |> submit()
      |> assert_has("select[name='user[language]'] option[value='ja'][selected]")

      assert Accounts.get_user_by_email(user.email).language == :ja
    end

    test "displays current language as selected", %{conn: conn, user: user} do
      # Update user to have German as language
      Accounts.update_user_settings(user, %{language: :de})

      conn
      |> visit(~p"/language")
      |> assert_has("select[name='user[language]'] option[value='de'][selected]")
    end

    test "form displays all available language options", %{conn: conn} do
      conn
      |> visit(~p"/language")
      |> assert_has("option[value='en']", text: "English")
      |> assert_has("option[value='es']", text: "Español")
      |> assert_has("option[value='fr']", text: "Français")
      |> assert_has("option[value='de']", text: "Deutsch")
      |> assert_has("option[value='ja']", text: "日本語")
      |> assert_has("option[value='ko']", text: "한국어")
      |> assert_has("option[value='pt']", text: "Português")
      |> assert_has("option[value='zh_Hans']", text: "简体中文")
      |> assert_has("option[value='zh_Hant']", text: "繁體中文")
    end
  end
end
