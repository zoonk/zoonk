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
      |> assert_has("span", text: "R$0")
      |> assert_has("span", text: "R$50")
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

    test "selects the plus plan when user clicks on it", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})

      conn
      |> visit(~p"/subscription")
      |> choose("Plus", exact: false)
      |> assert_has("input[checked]", name: "plan", value: "plus")
      |> refute_has("input[checked]", name: "plan", value: "free")
      |> assert_has("p", text: "Your subscription will renew automatically at $10/month")
    end

    test "updates the price when selecting yearly period", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})

      conn
      |> visit(~p"/subscription")
      |> choose("Yearly")
      |> assert_has("span", text: "$100")
      |> choose("Plus", exact: false)
      |> assert_has("p", text: "Your subscription will renew automatically at $100/year")
    end

    test "updates the price when selecting lifetime period", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})

      conn
      |> visit(~p"/subscription")
      |> choose("Lifetime")
      |> assert_has("span", text: "$300")
      |> choose("Plus", exact: false)
      |> assert_has("p", text: "You will pay $300 now and have access to the Plus plan forever")
    end
  end
end
