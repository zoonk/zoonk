defmodule ZoonkWeb.SubscriptionLiveTest do
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.BillingFixtures

  alias Zoonk.Billing

  describe "subscription page without billing account" do
    setup :signup_and_login_user

    test "creates billing account when country is selected and submitted", %{conn: conn, scope: scope} do
      stripe_stub(prefix: "cus_")

      conn
      |> visit(~p"/subscription")
      |> refute_has("h2", text: "Subscribe")
      |> assert_has("option", text: "Select your country")
      |> assert_has("option[value='BR']", text: "Brasil")
      |> select("Country", option: "United States")
      |> submit()
      |> assert_has("h2", text: "Subscribe")
      |> assert_has("h3", text: "Free Current Plan")
      |> assert_has("div", text: "$10 /month")

      billing_account = Billing.get_billing_account(scope)
      assert billing_account.country_iso2 == "US"
      assert billing_account.currency == "USD"
    end

    test "displays error message when billing account creation fails", %{conn: conn} do
      stripe_stub(error: true)

      conn
      |> visit(~p"/subscription")
      |> select("Country", option: "United States")
      |> submit()
      |> assert_has("[role='alert']", text: "Failed to create billing account. Please try again.")
    end

    test "infers correct currency for selected country", %{conn: conn, scope: scope} do
      stripe_stub(prefix: "cus_")

      conn
      |> visit(~p"/subscription")
      |> select("Country", option: "Brasil")
      |> submit()

      assert Billing.get_billing_account(scope).currency == "BRL"
    end
  end

  describe "subscription page with existing billing account" do
    setup :signup_and_login_user

    test "does not show country selection form when billing account exists", %{conn: conn, scope: scope} do
      billing_account_fixture(%{"scope" => scope})

      conn
      |> visit(~p"/subscription")
      |> refute_has("option", text: "Select your country")
    end

    test "displays subscription plans with correct currency", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope, "currency" => "BRL"})

      conn
      |> visit(~p"/subscription")
      |> assert_has("h2", text: "Subscribe")
      |> assert_has("div", text: "R$0")
      |> assert_has("div", text: "R$50 /month")
      |> refute_has("div", text: "$0 /month")
    end

    test "display dollar currency if user's currency isn't supported", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope, "currency" => "GBP"})

      conn
      |> visit(~p"/subscription")
      |> assert_has("h2", text: "Subscribe")
      |> assert_has("span", text: "$0")
      |> assert_has("span", text: "$10")
    end

    test "free plan is selected when user doesn't have a subscription", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})

      conn
      |> visit(~p"/subscription")
      |> assert_has("input[checked]", name: "plan", value: "free")
      |> refute_has("input[checked]", name: "plan", value: "plus")
      |> assert_has("p", text: "This is a limited plan")
      |> assert_has("h3", text: "Free Current Plan")
      |> refute_has("h3", text: "Plus Current Plan")
    end

    test "plus plan is selected when user has an active subscription", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})
      user_subscription_fixture(%{scope: scope, plan: :plus, status: :active})

      conn
      |> visit(~p"/subscription")
      |> assert_has("input[checked]", name: "plan", value: "plus")
      |> refute_has("input[checked]", name: "plan", value: "free")
      |> assert_has("h3", text: "Plus Current Plan")
      |> refute_has("h3", text: "Free Current Plan")
    end

    test "free plan is selected when user has an inactive subscription", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})
      user_subscription_fixture(%{scope: scope, plan: :plus, status: :canceled})

      conn
      |> visit(~p"/subscription")
      |> assert_has("input[checked]", name: "plan", value: "free")
      |> refute_has("input[checked]", name: "plan", value: "plus")
      |> assert_has("h3", text: "Free Current Plan")
      |> refute_has("h3", text: "Plus Current Plan")
    end

    test "selects the plus plan when user clicks on it", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})

      conn
      |> visit(~p"/subscription")
      |> choose("$10", exact: false)
      |> assert_has("input[checked]", name: "plan", value: "plus")
      |> refute_has("input[checked]", name: "plan", value: "free")
      |> assert_has("p", text: "Your subscription will renew automatically at $10/month")
    end

    test "updates the price when selecting yearly interval", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})

      conn
      |> visit(~p"/subscription")
      |> choose("Yearly")
      |> assert_has("div", text: "$100 /year")
      |> choose("$100", exact: false)
      |> assert_has("p", text: "Your subscription will renew automatically at $100/year")
    end

    test "disable subscribe button if free is selected and user has no subscription", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})

      conn
      |> visit(~p"/subscription")
      |> assert_has("button[disabled]", text: "Subscribe")
    end

    test "submit form with selected plan and interval", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})

      result =
        conn
        |> visit(~p"/subscription")
        |> choose("$10", exact: false)
        |> submit()

      path = request_url(result.conn)

      assert String.starts_with?(path, "https://checkout.stripe.com/session_")
    end

    test "select yearly by default when user has an yearly subscription", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})
      user_subscription_fixture(%{scope: scope, plan: :plus, status: :active, interval: :yearly})

      conn
      |> visit(~p"/subscription")
      |> assert_has("span", text: "$100")
    end

    test "cancels a subscription", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})
      user_subscription_fixture(%{scope: scope, plan: :plus, status: :active})

      conn
      |> visit(~p"/subscription")
      |> choose("$0", exact: false)
      |> assert_has("button", text: "Cancel Subscription")
      |> click_button("Cancel Subscription")
      |> assert_has("[role='alert']", text: "Your subscription has been canceled.")
      |> refute_has("h3", text: "Plus Current Plan")
      |> assert_has("h3", text: "Free Current Plan")
      |> refute_has("button", text: "Cancel Subscription")
      |> assert_has("button", text: "Subscribe")

      assert Billing.get_user_subscription(scope).status == :canceled
    end

    test "manages a subscription", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})
      user_subscription_fixture(%{scope: scope, plan: :plus, status: :active})

      result =
        conn
        |> visit(~p"/subscription")
        |> click_button("Manage Subscription")

      path = request_url(result.conn)

      assert String.starts_with?(path, "https://billing.stripe.com/p/session_")
    end

    test "redirects to the customer portal when trying to upgrade from plus to pro", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})
      user_subscription_fixture(%{scope: scope, plan: :plus, status: :active})

      result =
        conn
        |> visit(~p"/subscription")
        |> choose("$20", exact: false)
        |> assert_has("input[checked]", name: "plan", value: "pro")
        |> refute_has("input[checked]", name: "plan", value: "plus")
        |> assert_has("p", text: "Your subscription will renew automatically at $20/month")
        |> click_button("Upgrade")

      path = request_url(result.conn)

      assert String.starts_with?(path, "https://billing.stripe.com/p/session_")
    end

    test "redirects to the customer portal when trying to downgrade from pro to plus", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})
      user_subscription_fixture(%{scope: scope, plan: :pro, status: :active})

      result =
        conn
        |> visit(~p"/subscription")
        |> choose("$10", exact: false)
        |> assert_has("input[checked]", name: "plan", value: "plus")
        |> refute_has("input[checked]", name: "plan", value: "pro")
        |> assert_has("p", text: "Your subscription will renew automatically at $10/month")
        |> click_button("Downgrade")

      path = request_url(result.conn)

      assert String.starts_with?(path, "https://billing.stripe.com/p/session_")
    end
  end
end
