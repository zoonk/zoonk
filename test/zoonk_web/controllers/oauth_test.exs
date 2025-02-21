defmodule ZoonkWeb.OAuthControllerTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AuthFixtures

  alias Zoonk.Auth

  describe "GET /auth/:provider/callback" do
    test "redirects to signin page when authentication fails", %{conn: conn} do
      failure = %Ueberauth.Failure{}

      conn =
        conn
        |> assign(:ueberauth_failure, failure)
        |> get(~p"/auth/google/callback")

      assert redirected_to(conn) == ~p"/users/signin"
    end

    test "redirects to the home page if it succeeds", %{conn: conn} do
      email = unique_user_email()
      image = "https://zoonk.test/image.png"
      auth = %Ueberauth.Auth{provider: :google, uid: "123", info: %{email: email, image: image}}

      conn =
        conn
        |> bypass_through(ZoonkWeb.Router, :browser)
        |> get(~p"/auth/google/callback")
        |> assign(:ueberauth_failure, nil)
        |> assign(:ueberauth_auth, auth)
        |> ZoonkWeb.Controllers.OAuth.callback(%{})

      assert redirected_to(conn) == ~p"/"
      user = Auth.get_user_by_email(email)
      assert user.confirmed_at != nil
    end
  end
end
