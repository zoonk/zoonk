defmodule ZoonkWeb.Onboarding.OnboardingControllerTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures
  import Zoonk.OrgFixtures

  alias Zoonk.Accounts.User

  setup do
    org = app_org_fixture()

    conn =
      build_conn()
      |> Map.put(:host, org.custom_domain)
      |> put_req_header("accept-language", "pt-BR")

    %{conn: conn}
  end

  test "POST /start - creates a guest user and logs in", %{conn: conn} do
    query = "computer science"
    params = %{"language" => "en", "query" => query}
    conn = post(conn, ~p"/start", params)

    assert redirected_to(conn) == ~p"/start/#{query}"

    user_token = get_session(conn, :user_token)
    assert {%User{kind: :guest, language: :en}, _fn} = Zoonk.Accounts.get_user_by_session_token(user_token)

    # it should be logged in as a guest user now
    logged_in_conn = get(conn, ~p"/start/#{query}")
    assert get_session(logged_in_conn, :language) == "en"
    assert logged_in_conn.assigns.scope.user.kind == :guest
    assert html_response(logged_in_conn, 200)
  end

  test "POST /start - redirects when user is already logged in", %{conn: conn} do
    user = user_fixture()
    query = "computer science"
    params = %{"language" => "en", "query" => query}

    conn =
      conn
      |> login_user(user)
      |> post(~p"/start", params)

    assert redirected_to(conn) == ~p"/start/#{query}"

    # it should be logged in with the same user
    logged_in_conn = get(conn, ~p"/start/#{query}")
    assert logged_in_conn.assigns.scope.user.id == user.id
  end
end
