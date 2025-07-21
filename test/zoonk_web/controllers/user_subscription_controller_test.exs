defmodule ZoonkWeb.UserSubscriptionControllerTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.BillingFixtures

  describe "POST /subscription/checkout (unauthenticated)" do
    test "redirects to sign in page", %{conn: conn} do
      conn = post(conn, ~p"/subscription/checkout", %{"price" => "price_plus_monthly"})
      assert redirected_to(conn) == ~p"/login"
    end
  end

  describe "POST /subscription/checkout (authenticated)" do
    setup :signup_and_login_user

    test "creates checkout session and redirects to Stripe URL", %{conn: conn, scope: scope} do
      billing_account_fixture(%{"scope" => scope})

      stripe_stub(
        data: %{
          "url" => "https://checkout.stripe.com/session_123",
          "object" => "checkout.session"
        }
      )

      conn = post(conn, ~p"/subscription/checkout", %{"price" => "price_plus_monthly"})

      assert redirected_to(conn) =~ "https://checkout.stripe.com/session_123"
    end

    test "redirects with error flash when Stripe API fails", %{conn: conn, scope: scope} do
      billing_account_fixture(%{"scope" => scope})
      stripe_stub(error: true)

      conn = post(conn, ~p"/subscription/checkout", %{"price" => "price_plus_monthly"})

      assert redirected_to(conn) == ~p"/subscription"
      assert Phoenix.Flash.get(conn.assigns.flash, :error) =~ "Payment service is temporarily unavailable"
    end

    test "redirects with error flash when price parameter is missing", %{conn: conn, scope: scope} do
      billing_account_fixture(%{"scope" => scope})

      conn = post(conn, ~p"/subscription/checkout", %{})

      assert redirected_to(conn) == ~p"/subscription"
      assert Phoenix.Flash.get(conn.assigns.flash, :error) =~ "Invalid subscription request"
    end

    test "redirects with error flash when price parameter is not a string", %{conn: conn, scope: scope} do
      billing_account_fixture(%{"scope" => scope})

      conn = post(conn, ~p"/subscription/checkout", %{"price" => 123})

      assert redirected_to(conn) == ~p"/subscription"
      assert Phoenix.Flash.get(conn.assigns.flash, :error) =~ "Invalid subscription request"
    end

    test "uses correct return URL", %{conn: conn, scope: scope} do
      billing_account_fixture(%{"scope" => scope})

      stripe_stub(
        capture_to: self(),
        data: %{
          "url" => "https://checkout.stripe.com/session_123",
          "object" => "checkout.session"
        }
      )

      conn =
        conn
        |> Map.put(:host, "zoonk.test")
        |> Map.put(:port, 4000)
        |> post(~p"/subscription/checkout", %{"price" => "price_plus_monthly"})

      assert redirected_to(conn) =~ "https://checkout.stripe.com/session_123"

      assert_receive {:stripe_request, params}
      assert params["success_url"] == "http://zoonk.test:4000/subscription"
      assert params["cancel_url"] == "http://zoonk.test:4000/subscription"
    end

    test "creates checkout session with proper URL encoding", %{conn: conn, scope: scope} do
      billing_account_fixture(%{"scope" => scope})

      stripe_stub(
        data: %{
          "url" =>
            "https://checkout.stripe.com/c/pay/cs_test_special_chars#fidkdWxOYHwnPyd1blppbHNgWjA0S2BVVjB8QUNxQUZHSnFSbF9TRDR2ZUJANnZKM1AySWB2YmdUdENsU2xqZlFRbGEzXXRIV1w3T0w",
          "object" => "checkout.session"
        }
      )

      conn = post(conn, ~p"/subscription/checkout", %{"price" => "price_plus_monthly"})

      assert redirected_to(conn) =~ "https://checkout.stripe.com/c/pay/cs_test_special_chars"
    end

    test "redirects with error flash when billing account is missing", %{conn: conn} do
      # Don't create a billing account for this test
      stripe_stub(
        data: %{
          "url" => "https://checkout.stripe.com/session_123",
          "object" => "checkout.session"
        }
      )

      conn = post(conn, ~p"/subscription/checkout", %{"price" => "price_plus_monthly"})

      assert redirected_to(conn) == ~p"/subscription"
      assert Phoenix.Flash.get(conn.assigns.flash, :error) =~ "Please set up billing first"
    end

    test "handles empty price parameter", %{conn: conn, scope: scope} do
      billing_account_fixture(%{"scope" => scope})

      conn = post(conn, ~p"/subscription/checkout", %{"price" => ""})

      assert redirected_to(conn) == ~p"/subscription"
      assert Phoenix.Flash.get(conn.assigns.flash, :error) =~ "Invalid subscription request"
    end

    test "handles malformed parameters gracefully", %{conn: conn, scope: scope} do
      billing_account_fixture(%{"scope" => scope})

      conn = post(conn, ~p"/subscription/checkout", %{"invalid" => "data"})

      assert redirected_to(conn) == ~p"/subscription"
      assert Phoenix.Flash.get(conn.assigns.flash, :error) =~ "Invalid subscription request"
    end
  end
end
