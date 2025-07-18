defmodule ZoonkWeb.AppFeedbackLiveTest do
  use ZoonkWeb.ConnCase, async: true

  describe "feedback form" do
    setup :signup_and_login_user

    test "renders feedback form with user email pre-filled", %{conn: conn, user: user} do
      conn
      |> visit(~p"/feedback")
      |> assert_has("input[id='feedback-email'][value='#{user.email}']")
    end

    test "validates feedback message length", %{conn: conn} do
      conn
      |> visit(~p"/feedback")
      |> fill_in("Message", with: "short")
      |> assert_has("p", text: "should be at least 10 character(s)")
    end

    test "validates email format", %{conn: conn} do
      conn
      |> visit(~p"/feedback")
      |> fill_in("Email address", with: "invalid-email")
      |> assert_has("p", text: "has invalid format")
    end

    test "validates required fields on submit", %{conn: conn} do
      conn
      |> visit(~p"/feedback")
      |> fill_in("Email address", with: "")
      |> fill_in("Message", with: "")
      |> submit()
      |> assert_has("p", text: "can't be blank")
      |> refute_has("p", text: "Done!")
    end

    test "validates message length on submit", %{conn: conn} do
      conn
      |> visit(~p"/feedback")
      |> fill_in("Email address", with: "test@example.com")
      |> fill_in("Message", with: "short")
      |> submit()
      |> assert_has("p", text: "should be at least 10 character(s)")
      |> refute_has("p", text: "Done!")
    end

    test "sends feedback successfully and shows confirmation", %{conn: conn, user: user} do
      feedback_message = "This is a great app! I love using it every day."

      conn
      |> visit(~p"/feedback")
      |> refute_has("p", text: "Done!")
      |> fill_in("Email address", with: user.email)
      |> fill_in("Message", with: feedback_message)
      |> submit()
      |> assert_has("p", text: "Done!")
      |> assert_has("input[id='feedback-email'][value='#{user.email}']")
    end

    test "sends feedback with different email address", %{conn: conn} do
      different_email = "different@example.com"
      feedback_message = "Reporting an issue with the login process."

      conn
      |> visit(~p"/feedback")
      |> fill_in("Email address", with: different_email)
      |> fill_in("Message", with: feedback_message)
      |> submit()
      |> assert_has("p", text: "Done!")
    end
  end

  describe "feedback form for unauthenticated users" do
    test "renders feedback form with empty email field for unauthenticated users", %{conn: conn} do
      org = Zoonk.OrgFixtures.org_fixture(%{kind: :app})

      conn
      |> Map.put(:host, org.custom_domain)
      |> visit(~p"/feedback")
      |> assert_has("input[id='feedback-email'][value='']")
      |> assert_has("textarea[id='feedback-message']")
      |> assert_has("h3", text: "Send feedback")
    end

    test "allows unauthenticated users to send feedback", %{conn: conn} do
      org = Zoonk.OrgFixtures.org_fixture(%{kind: :app})
      user_email = "anonymous@example.com"
      feedback_message = "This is feedback from an unauthenticated user."

      conn
      |> Map.put(:host, org.custom_domain)
      |> visit(~p"/feedback")
      |> fill_in("Email address", with: user_email)
      |> fill_in("Message", with: feedback_message)
      |> submit()
      |> assert_has("p", text: "Done!")
    end
  end
end
