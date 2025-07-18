defmodule ZoonkWeb.AppSupportLiveTest do
  use ZoonkWeb.ConnCase, async: true

  describe "support request form" do
    setup :signup_and_login_user

    test "renders support form with user email pre-filled", %{conn: conn, user: user} do
      conn
      |> visit(~p"/support")
      |> assert_has("input[id='support-email'][value='#{user.email}']")
    end

    test "validates support message length", %{conn: conn} do
      conn
      |> visit(~p"/support")
      |> fill_in("Message", with: "short message")
      |> assert_has("p", text: "should be at least 15 character(s)")
    end

    test "validates email format", %{conn: conn} do
      conn
      |> visit(~p"/support")
      |> fill_in("Email address", with: "invalid-email")
      |> assert_has("p", text: "has invalid format")
    end

    test "validates required fields on submit", %{conn: conn} do
      conn
      |> visit(~p"/support")
      |> fill_in("Email address", with: "")
      |> fill_in("Message", with: "")
      |> submit()
      |> assert_has("p", text: "can't be blank")
      |> refute_has("p", text: "Done!")
    end

    test "validates message length on submit", %{conn: conn} do
      conn
      |> visit(~p"/support")
      |> fill_in("Email address", with: "test@example.com")
      |> fill_in("Message", with: "short message")
      |> submit()
      |> assert_has("p", text: "should be at least 15 character(s)")
      |> refute_has("p", text: "Done!")
    end

    test "sends support request successfully and shows confirmation", %{conn: conn, user: user} do
      support_message =
        "I'm having trouble logging into my account. When I enter my credentials, it shows an error message."

      conn
      |> visit(~p"/support")
      |> refute_has("p", text: "Done!")
      |> fill_in("Email address", with: user.email)
      |> fill_in("Message", with: support_message)
      |> submit()
      |> assert_has("p", text: "Done!")
      |> assert_has("input[id='support-email'][value='#{user.email}']")
    end

    test "sends support request with different email address", %{conn: conn} do
      different_email = "different@example.com"
      support_message = "I need help with setting up my account. The verification email is not arriving."

      conn
      |> visit(~p"/support")
      |> fill_in("Email address", with: different_email)
      |> fill_in("Message", with: support_message)
      |> submit()
      |> assert_has("p", text: "Done!")
    end
  end

  describe "support request form for unauthenticated users" do
    test "renders support form with empty email field for unauthenticated users", %{conn: conn} do
      org = Zoonk.OrgFixtures.org_fixture(%{kind: :app})

      conn
      |> Map.put(:host, org.custom_domain)
      |> visit(~p"/support")
      |> assert_has("input[id='support-email'][value='']")
      |> assert_has("textarea[id='support-message']")
      |> assert_has("h3", text: "Contact Support")
    end

    test "allows unauthenticated users to send support requests", %{conn: conn} do
      org = Zoonk.OrgFixtures.org_fixture(%{kind: :app})
      user_email = "anonymous@example.com"
      support_message = "I'm trying to create an account but the signup form is not working properly."

      conn
      |> Map.put(:host, org.custom_domain)
      |> visit(~p"/support")
      |> fill_in("Email address", with: user_email)
      |> fill_in("Message", with: support_message)
      |> submit()
      |> assert_has("p", text: "Done!")
    end
  end
end
