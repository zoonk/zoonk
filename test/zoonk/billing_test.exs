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

  describe "list_prices/0" do
    test "returns all prices when successful" do
      stripe_stub(
        data: %{
          "data" => [
            %{
              "id" => "price_starter_monthly",
              "lookup_key" => "starter_monthly",
              "unit_amount" => 500,
              "active" => true,
              "currency_options" => %{
                "usd" => %{"unit_amount" => 500},
                "brl" => %{"unit_amount" => 1990}
              }
            }
          ]
        }
      )

      assert {:ok, prices} = Billing.list_prices()

      assert %Price{} = first_price = hd(prices)
      assert first_price.plan == "starter_monthly"
      assert first_price.periodicity == "monthly"
      assert first_price.currencies["usd"] == 5
      assert first_price.currencies["brl"] == 19.90
    end

    test "returns error when Stripe API fails" do
      stripe_stub(error: true)
      assert {:error, "Invalid request"} = Billing.list_prices()
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
        plan: :premium,
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
        plan: :premium,
        payment_term: :yearly,
        status: :active,
        cancel_at_period_end: true
      }

      assert {:ok, %UserSubscription{} = updated} = Billing.update_user_subscription(scope, subscription, update_attrs)
      assert updated.id == subscription.id
      assert updated.user_id == user.id
      assert updated.org_id == org.id
      assert updated.plan == :premium
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
      user = user_fixture()

      stripe_stub(
        prefix: "cus_",
        data: %{
          "email" => user.email,
          "metadata" => %{"user_id" => to_string(user.id)},
          "preferred_locales" => [to_string(user.language)],
          "object" => "customer"
        }
      )

      attrs = %{"currency" => "usd", "country_iso2" => "us"}

      assert {:ok, %BillingAccount{} = billing_account} = Billing.create_billing_account(user, attrs)
      assert billing_account.user_id == user.id
      assert billing_account.currency == "USD"
      assert billing_account.country_iso2 == "US"
      assert billing_account.org_id == nil
      assert String.starts_with?(billing_account.stripe_customer_id, "cus_")
    end

    test "returns error with missing currency" do
      user = user_fixture()

      stripe_stub(prefix: "cus_")

      attrs = %{}

      assert {:error, changeset} = Billing.create_billing_account(user, attrs)
      assert "can't be blank" in errors_on(changeset).currency
    end

    test "returns error when user already has a billing account" do
      user = user_fixture()

      stripe_stub(prefix: "cus_")

      attrs = %{"currency" => "usd", "country_iso2" => "us"}

      assert {:ok, _account} = Billing.create_billing_account(user, attrs)
      assert {:error, changeset} = Billing.create_billing_account(user, attrs)
      assert "has already been taken" in errors_on(changeset).user_id
    end

    test "returns error when Stripe customer creation fails" do
      user = user_fixture()

      stripe_stub(error: true)

      attrs = %{"currency" => "usd", "country_iso2" => "us"}

      assert {:error, "Invalid request"} = Billing.create_billing_account(user, attrs)
    end
  end

  describe "get_billing_account/1" do
    test "returns billing account when user has one" do
      scope = scope_fixture()
      stripe_stub(prefix: "cus_")

      {:ok, billing_account} = Billing.create_billing_account(scope.user, %{"currency" => "USD", "country_iso2" => "US"})

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
      user = user_fixture()

      attrs = %{
        "address_line_1" => "123 Main St",
        "address_line_2" => "Apt 4B",
        "city" => "San Francisco",
        "state" => "CA",
        "postal_code" => "94102",
        "country_iso2" => "US"
      }

      stripe_stub(prefix: "cus_")

      assert {:ok, customer} = Billing.create_stripe_customer(user, attrs)
      assert String.starts_with?(customer["id"], "cus_")
    end

    test "creates customer with tax ID information" do
      user = user_fixture()

      attrs = %{
        "tax_id" => "12-3456789",
        "tax_id_type" => "us_ein",
        "country_iso2" => "US"
      }

      stripe_stub(prefix: "cus_")

      assert {:ok, customer} = Billing.create_stripe_customer(user, attrs)
      assert String.starts_with?(customer["id"], "cus_")
    end

    test "creates customer with full billing information" do
      user = user_fixture()

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

      assert {:ok, customer} = Billing.create_stripe_customer(user, attrs)
      assert String.starts_with?(customer["id"], "cus_")
    end

    test "handles stripe error when creating customer with additional data" do
      user = user_fixture()

      attrs = %{
        "address_line_1" => "123 Main St",
        "country_iso2" => "US"
      }

      stripe_stub(error: true)

      assert {:error, "Invalid request"} = Billing.create_stripe_customer(user, attrs)
    end
  end
end
