defmodule Zoonk.BillingTest do
  use Zoonk.DataCase, async: true

  import Zoonk.AccountFixtures
  import Zoonk.BillingFixtures
  import Zoonk.OrgFixtures

  alias Zoonk.Billing
  alias Zoonk.Billing.BillingAccount
  alias Zoonk.Billing.Price
  alias Zoonk.Billing.UserSubscription
  alias Zoonk.Scope

  describe "list_prices/1" do
    test "returns prices in billing account currency when available" do
      stripe_stub()

      billing_account = %BillingAccount{currency: "BRL"}
      assert {:ok, prices} = Billing.list_prices(billing_account)

      assert %Price{} = first_price = hd(prices)
      assert first_price.plan == :plus
      assert first_price.period == :monthly
      assert first_price.currency == "brl"
      assert first_price.value == "R$50"
      assert String.starts_with?(first_price.stripe_price_id, "price_")
    end

    test "falls back to USD when billing account currency is not available in Stripe" do
      stripe_stub()

      billing_account = %BillingAccount{currency: "CAD"}
      assert {:ok, prices} = Billing.list_prices(billing_account)

      assert %Price{} = first_price = hd(prices)
      assert first_price.plan == :plus
      assert first_price.period == :monthly
      assert first_price.currency == "usd"
      assert first_price.value == "$10"
      assert String.starts_with?(first_price.stripe_price_id, "price_")
    end

    test "uses USD when billing account is nil" do
      stripe_stub()

      assert {:ok, prices} = Billing.list_prices(nil)

      assert %Price{} = first_price = hd(prices)
      assert first_price.plan == :plus
      assert first_price.period == :monthly
      assert first_price.currency == "usd"
      assert first_price.value == "$10"
      assert String.starts_with?(first_price.stripe_price_id, "price_")
    end

    test "returns error when Stripe API fails" do
      stripe_stub(error: true)
      billing_account = %BillingAccount{currency: "USD"}
      assert {:error, "Invalid request"} = Billing.list_prices(billing_account)
    end
  end

  describe "create_user_subscription/2" do
    test "creates a subscription with valid data" do
      user = user_fixture()
      org = org_fixture()
      scope = %Scope{user: user, org: org}

      attrs = valid_user_subscription_attrs()

      assert {:ok, %UserSubscription{} = subscription} = Billing.create_user_subscription(scope, attrs)
      assert subscription.user_id == user.id
      assert subscription.org_id == org.id
      assert subscription.plan == attrs.plan
      assert subscription.payment_term == attrs.payment_term
      assert subscription.status == attrs.status
      assert subscription.stripe_subscription_id == attrs.stripe_subscription_id
      assert subscription.expires_at == attrs.expires_at
      refute subscription.cancel_at_period_end
    end

    test "cannot override user_id from scope" do
      user = user_fixture()
      another_user = user_fixture()
      org = org_fixture()
      scope = %Scope{user: user, org: org}

      attrs = valid_user_subscription_attrs(%{user_id: another_user.id})

      assert {:ok, %UserSubscription{} = subscription} = Billing.create_user_subscription(scope, attrs)
      assert subscription.user_id == user.id
    end

    test "cannot override org_id from scope" do
      user = user_fixture()
      org = org_fixture()
      another_org = org_fixture()
      scope = %Scope{user: user, org: org}

      attrs = valid_user_subscription_attrs(%{org_id: another_org.id})

      assert {:ok, %UserSubscription{} = subscription} = Billing.create_user_subscription(scope, attrs)
      assert subscription.org_id == org.id
    end

    test "returns error with invalid data" do
      user = user_fixture()
      org = org_fixture()
      scope = %Scope{user: user, org: org}
      invalid_attrs = %{}

      assert {:error, %Ecto.Changeset{}} = Billing.create_user_subscription(scope, invalid_attrs)
    end

    test "sets correct default values" do
      user = user_fixture()
      org = org_fixture()
      scope = %Scope{user: user, org: org}

      # Only providing required fields, letting defaults handle the rest
      expires_at = DateTime.add(DateTime.utc_now(), 30, :day)

      attrs = %{
        status: :active,
        expires_at: expires_at
      }

      assert {:ok, %UserSubscription{} = subscription} = Billing.create_user_subscription(scope, attrs)
      assert subscription.plan == :free
      assert subscription.payment_term == :monthly
      assert subscription.status == :active
      assert subscription.expires_at == expires_at
      refute subscription.cancel_at_period_end
    end

    test "sets far-future expiration date for lifetime subscriptions" do
      user = user_fixture()
      org = org_fixture()
      scope = %Scope{user: user, org: org}

      attrs = %{
        plan: :plus,
        payment_term: :lifetime,
        status: :active
      }

      assert {:ok, %UserSubscription{} = subscription} = Billing.create_user_subscription(scope, attrs)
      assert subscription.payment_term == :lifetime

      # Check that the expires_at is set to Dec 31, 9999
      assert subscription.expires_at.year == 9999
      assert subscription.expires_at.month == 12
      assert subscription.expires_at.day == 31
      assert subscription.expires_at.hour == 23
      assert subscription.expires_at.minute == 59
      assert subscription.expires_at.second == 59
    end
  end

  describe "update_user_subscription/3" do
    test "updates a subscription with valid data" do
      user = user_fixture()
      org = org_fixture()
      scope = %Scope{user: user, org: org}

      # First create a subscription
      attrs = valid_user_subscription_attrs()
      {:ok, subscription} = Billing.create_user_subscription(scope, attrs)

      # Now update it
      update_attrs = %{
        plan: :plus,
        payment_term: :yearly,
        status: :active,
        cancel_at_period_end: true
      }

      assert {:ok, %UserSubscription{} = updated} = Billing.update_user_subscription(scope, subscription, update_attrs)
      assert updated.id == subscription.id
      assert updated.user_id == user.id
      assert updated.org_id == org.id
      assert updated.plan == :plus
      assert updated.payment_term == :yearly
      assert updated.status == :active
      assert updated.cancel_at_period_end == true
    end

    test "cannot override user_id from scope when updating" do
      user = user_fixture()
      another_user = user_fixture()
      org = org_fixture()
      scope = %Scope{user: user, org: org}

      # Create subscription
      {:ok, subscription} = Billing.create_user_subscription(scope, valid_user_subscription_attrs())

      # Attempt to update user_id
      update_attrs = %{user_id: another_user.id}

      assert {:ok, %UserSubscription{} = updated} = Billing.update_user_subscription(scope, subscription, update_attrs)
      # Should remain unchanged
      assert updated.user_id == user.id
    end

    test "cannot override org_id from scope when updating" do
      user = user_fixture()
      org = org_fixture()
      another_org = org_fixture()
      scope = %Scope{user: user, org: org}

      # Create subscription
      {:ok, subscription} = Billing.create_user_subscription(scope, valid_user_subscription_attrs())

      # Attempt to update org_id
      update_attrs = %{org_id: another_org.id}

      assert {:ok, %UserSubscription{} = updated} = Billing.update_user_subscription(scope, subscription, update_attrs)
      # Should remain unchanged
      assert updated.org_id == org.id
    end

    test "returns error with invalid data when updating" do
      user = user_fixture()
      org = org_fixture()
      scope = %Scope{user: user, org: org}

      # Create subscription
      {:ok, subscription} = Billing.create_user_subscription(scope, valid_user_subscription_attrs())

      # Invalid status
      invalid_attrs = %{status: :invalid_status}

      assert {:error, %Ecto.Changeset{}} = Billing.update_user_subscription(scope, subscription, invalid_attrs)
    end
  end

  describe "cancel_user_subscription/2" do
    test "successfully cancels a subscription with Stripe subscription ID" do
      %Scope{user: user} = scope = scope_fixture()
      subscription = user_subscription_fixture(%{user: user, stripe_subscription_id: "sub_12345"})

      stripe_stub(prefix: "/subscriptions/sub_12345", data: %{"status" => "canceled"})

      assert {:ok, canceled_subscription} = Billing.cancel_user_subscription(scope, subscription)

      assert canceled_subscription.status == :canceled
      assert canceled_subscription.cancel_at_period_end == true
      assert canceled_subscription.stripe_subscription_id == "sub_12345"
    end

    test "successfully cancels a subscription without Stripe subscription ID" do
      %Scope{user: user} = scope = scope_fixture()
      subscription = user_subscription_fixture(%{user: user, stripe_subscription_id: nil})

      assert {:ok, canceled_subscription} = Billing.cancel_user_subscription(scope, subscription)
      assert canceled_subscription.status == :canceled
      assert canceled_subscription.cancel_at_period_end == true
      assert canceled_subscription.stripe_subscription_id == nil
    end

    test "handles Stripe API errors" do
      %Scope{user: user} = scope = scope_fixture()
      subscription = user_subscription_fixture(%{user: user, stripe_subscription_id: "sub_error"})

      stripe_stub(error: true)

      assert {:error, "Invalid request"} = Billing.cancel_user_subscription(scope, subscription)
    end
  end

  describe "create_billing_account/2" do
    test "creates a billing account with valid user data and creates Stripe customer" do
      scope = scope_fixture()

      stripe_stub(
        prefix: "cus_",
        data: %{
          "email" => scope.user.email,
          "metadata" => %{"user_id" => to_string(scope.user.id)},
          "preferred_locales" => [to_string(scope.user.language)],
          "object" => "customer"
        }
      )

      attrs = %{"currency" => "usd", "country_iso2" => "us"}

      assert {:ok, %BillingAccount{} = billing_account} = Billing.create_billing_account(scope, attrs)
      assert billing_account.user_id == scope.user.id
      assert billing_account.currency == "USD"
      assert billing_account.country_iso2 == "US"
      assert billing_account.org_id == nil
      assert String.starts_with?(billing_account.stripe_customer_id, "cus_")
    end

    test "returns error with missing currency" do
      scope = scope_fixture()

      stripe_stub(prefix: "cus_")

      attrs = %{}

      assert {:error, changeset} = Billing.create_billing_account(scope, attrs)
      assert "can't be blank" in errors_on(changeset).currency
    end

    test "returns error when user already has a billing account" do
      scope = scope_fixture()

      stripe_stub(prefix: "cus_")

      attrs = %{"currency" => "usd", "country_iso2" => "us"}

      assert {:ok, _account} = Billing.create_billing_account(scope, attrs)
      assert {:error, changeset} = Billing.create_billing_account(scope, attrs)
      assert "has already been taken" in errors_on(changeset).user_id
    end

    test "returns error when Stripe customer creation fails" do
      scope = scope_fixture()

      stripe_stub(error: true)

      attrs = %{"currency" => "usd", "country_iso2" => "us"}

      assert {:error, "Invalid request"} = Billing.create_billing_account(scope, attrs)
    end
  end

  describe "update_billing_account/3" do
    test "updates a billing account with valid data and updates Stripe customer" do
      scope = scope_fixture()

      stripe_stub(prefix: "cus_")
      {:ok, billing_account} = Billing.create_billing_account(scope, %{"currency" => "USD", "country_iso2" => "US"})

      stripe_stub(
        prefix: "/customers/#{billing_account.stripe_customer_id}",
        data: %{
          "id" => billing_account.stripe_customer_id,
          "email" => scope.user.email,
          "address" => %{
            "city" => "Paris",
            "country" => "FR"
          },
          "object" => "customer"
        }
      )

      update_attrs = %{"currency" => "EUR", "country_iso2" => "FR", "city" => "Paris"}

      assert {:ok, %BillingAccount{} = updated_account} =
               Billing.update_billing_account(scope, billing_account, update_attrs)

      assert updated_account.id == billing_account.id
      assert updated_account.user_id == scope.user.id
      assert updated_account.stripe_customer_id == billing_account.stripe_customer_id
      assert updated_account.currency == "EUR"
      assert updated_account.country_iso2 == "FR"
    end

    test "updates billing account with address information" do
      scope = scope_fixture()

      # Create billing account first
      stripe_stub(prefix: "cus_")
      {:ok, billing_account} = Billing.create_billing_account(scope, %{"currency" => "USD", "country_iso2" => "US"})

      # Mock Stripe customer update
      stripe_stub(prefix: "/customers/#{billing_account.stripe_customer_id}")

      update_attrs = %{
        "name" => "John Doe",
        "phone" => "+33123456789",
        "address_line_1" => "123 Main St",
        "address_line_2" => "Apt 4B",
        "city" => "Paris",
        "state" => "Île-de-France",
        "postal_code" => "75001",
        "country_iso2" => "FR"
      }

      assert {:ok, %BillingAccount{} = updated_account} =
               Billing.update_billing_account(scope, billing_account, update_attrs)

      assert updated_account.id == billing_account.id
      assert updated_account.user_id == scope.user.id
      assert updated_account.stripe_customer_id == billing_account.stripe_customer_id
    end

    test "updates billing account with tax ID information" do
      scope = scope_fixture()

      # Create billing account first
      stripe_stub(prefix: "cus_")
      {:ok, billing_account} = Billing.create_billing_account(scope, %{"currency" => "USD", "country_iso2" => "US"})

      # Mock Stripe customer update
      stripe_stub(prefix: "/customers/#{billing_account.stripe_customer_id}")

      update_attrs = %{
        "tax_id" => "123456789",
        "tax_id_type" => "eu_vat",
        "country_iso2" => "FR"
      }

      assert {:ok, %BillingAccount{} = updated_account} =
               Billing.update_billing_account(scope, billing_account, update_attrs)

      assert updated_account.id == billing_account.id
      assert updated_account.country_iso2 == "FR"
    end

    test "returns error with invalid billing account data" do
      scope = scope_fixture()

      # Create billing account first
      stripe_stub(prefix: "cus_")
      {:ok, billing_account} = Billing.create_billing_account(scope, %{"currency" => "USD", "country_iso2" => "US"})

      # Mock Stripe customer update (will succeed)
      stripe_stub(prefix: "/customers/#{billing_account.stripe_customer_id}")

      # Invalid currency
      invalid_attrs = %{"currency" => nil}

      assert {:error, %Ecto.Changeset{}} = Billing.update_billing_account(scope, billing_account, invalid_attrs)
    end

    test "returns error when Stripe customer update fails" do
      scope = scope_fixture()

      # Create billing account first
      stripe_stub(prefix: "cus_")
      {:ok, billing_account} = Billing.create_billing_account(scope, %{"currency" => "USD", "country_iso2" => "US"})

      # Mock Stripe error
      stripe_stub(error: true)

      update_attrs = %{"currency" => "EUR", "country_iso2" => "FR"}

      assert {:error, "Invalid request"} = Billing.update_billing_account(scope, billing_account, update_attrs)
    end

    test "does not change user_id or stripe_customer_id when updating" do
      scope = scope_fixture()

      # Create billing account first
      stripe_stub(prefix: "cus_")
      {:ok, billing_account} = Billing.create_billing_account(scope, %{"currency" => "USD", "country_iso2" => "US"})

      original_user_id = billing_account.user_id
      original_stripe_customer_id = billing_account.stripe_customer_id

      # Mock Stripe customer update
      stripe_stub(prefix: "/customers/#{billing_account.stripe_customer_id}")

      # Try to update with different user_id and stripe_customer_id (should be ignored)
      update_attrs = %{
        "currency" => "EUR",
        "user_id" => 99_999,
        "stripe_customer_id" => "cus_different"
      }

      assert {:ok, %BillingAccount{} = updated_account} =
               Billing.update_billing_account(scope, billing_account, update_attrs)

      assert updated_account.user_id == original_user_id
      assert updated_account.stripe_customer_id == original_stripe_customer_id
      assert updated_account.currency == "EUR"
    end
  end

  describe "get_billing_account/1" do
    test "returns billing account when user has one" do
      scope = scope_fixture()
      stripe_stub(prefix: "cus_")

      {:ok, billing_account} = Billing.create_billing_account(scope, %{"currency" => "USD", "country_iso2" => "US"})

      result = Billing.get_billing_account(scope)
      assert result.id == billing_account.id
      assert result.user_id == scope.user.id
    end

    test "returns nil when user has no billing account" do
      scope = scope_fixture()
      refute Billing.get_billing_account(scope)
    end
  end

  describe "get_unique_currencies/0" do
    test "returns unique currencies sorted by code" do
      currencies = Billing.get_unique_currencies()

      assert Enum.empty?(currencies) == false

      # Check that they are sorted by code
      codes = Enum.map(currencies, & &1.code)
      assert codes == Enum.sort(codes)

      # Check that currencies are unique
      assert length(codes) == length(Enum.uniq(codes))
    end
  end

  describe "change_billing_account_form/2" do
    test "returns a changeset for billing account form" do
      billing_account = %BillingAccount{}
      attrs = %{"country_iso2" => "US", "currency" => "USD", "city" => "San Francisco"}

      changeset = Billing.change_billing_account_form(billing_account, attrs)

      assert %Ecto.Changeset{} = changeset
      assert changeset.data == billing_account
    end
  end

  describe "create_stripe_customer/2 with address and tax data" do
    test "creates customer with address information" do
      scope = scope_fixture()

      attrs = %{
        "address_line_1" => "123 Main St",
        "address_line_2" => "Apt 4B",
        "city" => "San Francisco",
        "state" => "CA",
        "postal_code" => "94102",
        "country_iso2" => "US"
      }

      stripe_stub(prefix: "cus_")

      assert {:ok, customer} = Billing.create_stripe_customer(scope, attrs)
      assert String.starts_with?(customer["id"], "cus_")
    end

    test "creates customer with tax ID information" do
      scope = scope_fixture()

      attrs = %{
        "tax_id" => "12-3456789",
        "tax_id_type" => "us_ein",
        "country_iso2" => "US"
      }

      stripe_stub(prefix: "cus_")

      assert {:ok, customer} = Billing.create_stripe_customer(scope, attrs)
      assert String.starts_with?(customer["id"], "cus_")
    end

    test "creates customer with full billing information" do
      scope = scope_fixture()

      attrs = %{
        "address_line_1" => "123 Main St",
        "city" => "San Francisco",
        "state" => "CA",
        "postal_code" => "94102",
        "country_iso2" => "US",
        "tax_id" => "12-3456789",
        "tax_id_type" => "us_ein"
      }

      stripe_stub(prefix: "cus_")

      assert {:ok, customer} = Billing.create_stripe_customer(scope, attrs)
      assert String.starts_with?(customer["id"], "cus_")
    end

    test "handles stripe error when creating customer with additional data" do
      scope = scope_fixture()

      attrs = %{
        "address_line_1" => "123 Main St",
        "country_iso2" => "US"
      }

      stripe_stub(error: true)

      assert {:error, "Invalid request"} = Billing.create_stripe_customer(scope, attrs)
    end
  end

  describe "update_stripe_customer/2" do
    test "updates customer with name and phone" do
      scope = scope_fixture()
      stripe_stub(prefix: "cus_")

      # First create a billing account
      {:ok, _billing_account} = Billing.create_billing_account(scope, %{"currency" => "USD", "country_iso2" => "US"})

      attrs = %{
        "name" => "John Doe",
        "phone" => "+1234567890"
      }

      stripe_stub(prefix: "cus_")

      assert {:ok, customer} = Billing.update_stripe_customer(scope, attrs)
      assert String.starts_with?(customer["id"], "cus_")
    end

    test "updates customer with address information" do
      scope = scope_fixture()
      stripe_stub(prefix: "cus_")

      # First create a billing account
      {:ok, _billing_account} = Billing.create_billing_account(scope, %{"currency" => "USD", "country_iso2" => "US"})

      attrs = %{
        "address_line_1" => "456 Oak St",
        "address_line_2" => "Suite 200",
        "city" => "New York",
        "state" => "NY",
        "postal_code" => "10001",
        "country_iso2" => "US"
      }

      stripe_stub(prefix: "cus_")

      assert {:ok, customer} = Billing.update_stripe_customer(scope, attrs)
      assert String.starts_with?(customer["id"], "cus_")
    end

    test "updates customer with tax ID information" do
      scope = scope_fixture()
      stripe_stub(prefix: "cus_")

      # First create a billing account
      {:ok, _billing_account} = Billing.create_billing_account(scope, %{"currency" => "USD", "country_iso2" => "US"})

      attrs = %{
        "tax_id" => "98-7654321",
        "tax_id_type" => "us_ein",
        "country_iso2" => "US"
      }

      stripe_stub(prefix: "cus_")

      assert {:ok, customer} = Billing.update_stripe_customer(scope, attrs)
      assert String.starts_with?(customer["id"], "cus_")
    end

    test "updates customer with full billing information" do
      scope = scope_fixture()
      stripe_stub(prefix: "cus_")

      # First create a billing account
      {:ok, _billing_account} = Billing.create_billing_account(scope, %{"currency" => "USD", "country_iso2" => "US"})

      attrs = %{
        "name" => "Jane Smith",
        "phone" => "+1987654321",
        "address_line_1" => "789 Pine Ave",
        "city" => "Los Angeles",
        "state" => "CA",
        "postal_code" => "90210",
        "country_iso2" => "US",
        "tax_id" => "87-6543210",
        "tax_id_type" => "us_ein"
      }

      stripe_stub(prefix: "cus_")

      assert {:ok, customer} = Billing.update_stripe_customer(scope, attrs)
      assert String.starts_with?(customer["id"], "cus_")
    end

    test "returns error when no billing account exists" do
      scope = scope_fixture()

      attrs = %{
        "name" => "John Doe"
      }

      assert {:error, "No billing account found"} = Billing.update_stripe_customer(scope, attrs)
    end

    test "handles stripe error when updating customer" do
      scope = scope_fixture()
      stripe_stub(prefix: "cus_")

      # First create a billing account
      {:ok, _billing_account} = Billing.create_billing_account(scope, %{"currency" => "USD", "country_iso2" => "US"})

      attrs = %{
        "name" => "John Doe"
      }

      stripe_stub(error: true)

      assert {:error, "Invalid request"} = Billing.update_stripe_customer(scope, attrs)
    end
  end

  describe "get_user_subscription/1" do
    test "returns active subscription for user and org" do
      user = user_fixture()
      org = org_fixture()
      scope = %Scope{user: user, org: org}

      # Create a subscription
      attrs = valid_user_subscription_attrs(%{status: :active})
      {:ok, subscription} = Billing.create_user_subscription(scope, attrs)

      result = Billing.get_user_subscription(scope)
      assert result.id == subscription.id
      assert result.user_id == user.id
      assert result.org_id == org.id
    end

    test "returns nil when no active subscription exists" do
      user = user_fixture()
      org = org_fixture()
      scope = %Scope{user: user, org: org}

      refute Billing.get_user_subscription(scope)
    end

    test "returns most recent active subscription when multiple exist" do
      user = user_fixture()
      org = org_fixture()
      scope = %Scope{user: user, org: org}

      # Create older subscription
      attrs1 = valid_user_subscription_attrs(%{status: :active})
      {:ok, _old_subscription} = Billing.create_user_subscription(scope, attrs1)

      # Wait a moment to ensure different timestamps
      :timer.sleep(10)

      # Create newer subscription
      attrs2 = valid_user_subscription_attrs(%{status: :active, stripe_subscription_id: "sub_newer"})
      {:ok, new_subscription} = Billing.create_user_subscription(scope, attrs2)

      result = Billing.get_user_subscription(scope)
      assert result.id == new_subscription.id
    end

    test "ignores canceled and inactive subscriptions" do
      user = user_fixture()
      org = org_fixture()
      scope = %Scope{user: user, org: org}

      # Create canceled subscription
      attrs = valid_user_subscription_attrs(%{status: :canceled})
      {:ok, _canceled} = Billing.create_user_subscription(scope, attrs)

      refute Billing.get_user_subscription(scope)
    end

    test "returns nil when user or org is nil" do
      user = user_fixture()
      org = org_fixture()

      refute Billing.get_user_subscription(%Scope{user: nil, org: org})
      refute Billing.get_user_subscription(%Scope{user: user, org: nil})
      refute Billing.get_user_subscription(%Scope{user: nil, org: nil})
    end
  end

  describe "create_checkout_session/3" do
    test "creates subscription checkout session for monthly plan" do
      scope = scope_fixture()
      stripe_stub(prefix: "cus_")

      # Create billing account
      {:ok, _billing_account} = Billing.create_billing_account(scope, %{"currency" => "USD", "country_iso2" => "US"})

      # Mock Stripe checkout session
      stripe_stub(
        prefix: "cs_",
        data: %{
          "url" => "https://checkout.stripe.com/pay/cs_test123"
        }
      )

      assert {:ok, %{"id" => session_id, "url" => checkout_url}} = 
               Billing.create_checkout_session(scope, :plus, :monthly)

      assert String.starts_with?(session_id, "cs_")
      assert String.contains?(checkout_url, "checkout.stripe.com")
    end

    test "creates payment checkout session for lifetime plan" do
      scope = scope_fixture()
      stripe_stub(prefix: "cus_")

      # Create billing account
      {:ok, _billing_account} = Billing.create_billing_account(scope, %{"currency" => "USD", "country_iso2" => "US"})

      # Mock Stripe checkout session
      stripe_stub(
        prefix: "cs_",
        data: %{
          "url" => "https://checkout.stripe.com/pay/cs_lifetime123"
        }
      )

      assert {:ok, %{"id" => session_id, "url" => checkout_url}} = 
               Billing.create_checkout_session(scope, :plus, :lifetime)

      assert String.starts_with?(session_id, "cs_")
      assert String.contains?(checkout_url, "checkout.stripe.com")
    end

    test "returns error when no billing account exists" do
      scope = scope_fixture()

      assert {:error, "No billing account found"} = 
               Billing.create_checkout_session(scope, :plus, :monthly)
    end

    test "returns error for invalid plan" do
      scope = scope_fixture()

      assert {:error, "Invalid plan or payment term"} = 
               Billing.create_checkout_session(scope, :invalid, :monthly)
    end

    test "returns error when Stripe API fails" do
      scope = scope_fixture()
      stripe_stub(prefix: "cus_")

      # Create billing account
      {:ok, _billing_account} = Billing.create_billing_account(scope, %{"currency" => "USD", "country_iso2" => "US"})

      # Mock Stripe error
      stripe_stub(error: true)

      assert {:error, "Invalid request"} = 
               Billing.create_checkout_session(scope, :plus, :monthly)
    end
  end

  describe "create_customer_portal_session/1" do
    test "creates customer portal session" do
      scope = scope_fixture()
      stripe_stub(prefix: "cus_")

      # Create billing account
      {:ok, _billing_account} = Billing.create_billing_account(scope, %{"currency" => "USD", "country_iso2" => "US"})

      # Mock Stripe portal session
      stripe_stub(
        prefix: "bps_",
        data: %{
          "url" => "https://billing.stripe.com/session/bps_test123"
        }
      )

      assert {:ok, %{"id" => session_id, "url" => portal_url}} = 
               Billing.create_customer_portal_session(scope)

      assert String.starts_with?(session_id, "bps_")
      assert String.contains?(portal_url, "billing.stripe.com")
    end

    test "returns error when no billing account exists" do
      scope = scope_fixture()

      assert {:error, "No billing account found"} = 
               Billing.create_customer_portal_session(scope)
    end

    test "returns error when Stripe API fails" do
      scope = scope_fixture()
      stripe_stub(prefix: "cus_")

      # Create billing account
      {:ok, _billing_account} = Billing.create_billing_account(scope, %{"currency" => "USD", "country_iso2" => "US"})

      # Mock Stripe error
      stripe_stub(error: true)

      assert {:error, "Invalid request"} = 
               Billing.create_customer_portal_session(scope)
    end
  end
end
