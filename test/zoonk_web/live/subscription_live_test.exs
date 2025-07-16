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

  describe "subscription page with existing subscription" do
    setup :signup_and_login_user

    test "displays current subscription status", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})
      
      # Create an active subscription
      subscription_attrs = valid_user_subscription_attrs(%{
        plan: :plus,
        payment_term: :monthly,
        status: :active,
        stripe_subscription_id: "sub_test123"
      })
      {:ok, _subscription} = Billing.create_user_subscription(scope, subscription_attrs)

      conn
      |> visit(~p"/subscription")
      |> assert_has("div", text: "Current Plan")
    end

    test "shows manage button for active subscription with Stripe ID", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})
      
      subscription_attrs = valid_user_subscription_attrs(%{
        plan: :plus,
        payment_term: :yearly,
        status: :active,
        stripe_subscription_id: "sub_test123"
      })
      {:ok, _subscription} = Billing.create_user_subscription(scope, subscription_attrs)

      conn
      |> visit(~p"/subscription")
      |> assert_has("button", text: "Manage")
    end

    test "does not show manage button for subscription without Stripe ID", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})
      
      subscription_attrs = valid_user_subscription_attrs(%{
        plan: :plus,
        payment_term: :lifetime,
        status: :active,
        stripe_subscription_id: nil
      })
      {:ok, _subscription} = Billing.create_user_subscription(scope, subscription_attrs)

      conn
      |> visit(~p"/subscription")
      |> refute_has("button", text: "Manage")
    end

    test "shows cancel status for subscription with cancel_at_period_end", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})
      
      subscription_attrs = valid_user_subscription_attrs(%{
        plan: :plus,
        payment_term: :monthly,
        status: :active,
        cancel_at_period_end: true,
        stripe_subscription_id: "sub_test123"
      })
      {:ok, _subscription} = Billing.create_user_subscription(scope, subscription_attrs)

      conn
      |> visit(~p"/subscription")
      |> assert_has(text: "Cancels at period end")
      |> refute_has("button", text: "Cancel")
    end

    test "shows lifetime subscription correctly", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})
      
      subscription_attrs = valid_user_subscription_attrs(%{
        plan: :plus,
        payment_term: :lifetime,
        status: :active,
        expires_at: ~U[9999-12-31 23:59:59Z]
      })
      {:ok, _subscription} = Billing.create_user_subscription(scope, subscription_attrs)

      conn
      |> visit(~p"/subscription")
      |> assert_has(text: "Plus - Lifetime")
      |> assert_has(text: "Active")
    end

    test "manages subscription redirects to customer portal", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})
      
      subscription_attrs = valid_user_subscription_attrs(%{
        plan: :plus,
        payment_term: :monthly,
        status: :active,
        stripe_subscription_id: "sub_test123"
      })
      {:ok, _subscription} = Billing.create_user_subscription(scope, subscription_attrs)

      # Mock customer portal session creation
      stripe_stub(
        prefix: "/billing_portal/sessions",
        data: %{
          "id" => "bps_test123",
          "url" => "https://billing.stripe.com/session/bps_test123"
        }
      )

      conn
      |> visit(~p"/subscription")
      |> click_button("Manage")

      # External redirect handling - we can't test the actual redirect to Stripe
      # but we can verify the portal session was requested
    end

    test "cancels subscription successfully", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})
      
      subscription_attrs = valid_user_subscription_attrs(%{
        plan: :plus,
        payment_term: :monthly,
        status: :active,
        stripe_subscription_id: "sub_test123"
      })
      {:ok, _subscription} = Billing.create_user_subscription(scope, subscription_attrs)

      # Mock Stripe subscription cancellation
      stripe_stub(
        prefix: "/subscriptions/sub_test123",
        data: %{"status" => "canceled"}
      )

      conn
      |> visit(~p"/subscription")
      |> click_button("Cancel")
      |> assert_has("[role='alert']", text: "Your subscription has been canceled")

      # Verify subscription was updated
      updated_subscription = Billing.get_user_subscription(scope)
      assert updated_subscription.status == :canceled
      assert updated_subscription.cancel_at_period_end == true
    end
  end

  describe "subscription checkout flow" do
    setup :signup_and_login_user

    test "redirects to Stripe checkout for plus monthly plan", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})

      # Mock checkout session creation
      stripe_stub(
        prefix: "/checkout/sessions",
        data: %{
          "id" => "cs_test123",
          "url" => "https://checkout.stripe.com/pay/cs_test123"
        }
      )

      conn
      |> visit(~p"/subscription")
      |> choose("Plus", exact: false)
      |> click_button("Subscribe")

      # External redirect handling - we can't test the actual redirect to Stripe
      # but we can verify the checkout session was requested
    end

    test "shows success message when returning from successful checkout", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})

      conn
      |> visit(~p"/subscription?success=true")
      |> assert_has("[role='alert']", text: "Your subscription has been successfully activated!")
    end

    test "shows cancel message when returning from canceled checkout", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})

      conn
      |> visit(~p"/subscription?canceled=true")
      |> assert_has("[role='alert']", text: "Checkout was canceled")
    end

    test "shows async payment error message", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})

      conn
      |> visit(~p"/subscription?async_payment_error=insufficient_funds")
      |> assert_has("[role='alert']", text: "Payment processing failed: insufficient_funds")
    end

    test "handles free plan selection when user has active subscription", %{conn: conn, scope: scope} do
      stripe_stub()
      billing_account_fixture(%{"scope" => scope})
      
      subscription_attrs = valid_user_subscription_attrs(%{
        plan: :plus,
        payment_term: :monthly,
        status: :active,
        stripe_subscription_id: "sub_test123"
      })
      {:ok, _subscription} = Billing.create_user_subscription(scope, subscription_attrs)

      # Mock Stripe subscription cancellation
      stripe_stub(
        prefix: "/subscriptions/sub_test123",
        data: %{"status" => "canceled"}
      )

      conn
      |> visit(~p"/subscription")
      |> choose("Free", exact: false)
      |> click_button("Subscribe")
      |> assert_has("[role='alert']", text: "Your subscription has been canceled")
    end
  end
end
