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
  end
end
