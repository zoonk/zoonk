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
      assert first_price.interval == :monthly
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
      assert first_price.interval == :monthly
      assert first_price.currency == "usd"
      assert first_price.value == "$10"
      assert String.starts_with?(first_price.stripe_price_id, "price_")
    end

    test "uses USD when billing account is nil" do
      stripe_stub()

      assert {:ok, prices} = Billing.list_prices(nil)

      assert %Price{} = first_price = hd(prices)
      assert first_price.plan == :plus
      assert first_price.interval == :monthly
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
      assert subscription.interval == attrs.interval
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
      expires_at =
        DateTime.utc_now()
        |> DateTime.add(30, :day)
        |> DateTime.truncate(:second)

      attrs = %{
        status: :active,
        expires_at: expires_at
      }

      assert {:ok, %UserSubscription{} = subscription} = Billing.create_user_subscription(scope, attrs)
      assert subscription.plan == :free
      assert subscription.interval == :monthly
      assert subscription.status == :active
      assert subscription.expires_at == expires_at
      refute subscription.cancel_at_period_end
    end
  end

  describe "update_user_subscription/2" do
    test "updates a subscription with valid data" do
      user = user_fixture()
      org = org_fixture()
      subscription = user_subscription_fixture(%{user: user, org: org})
      scope = %Scope{user: user, org: org, subscription: subscription}

      # Now update it
      update_attrs = %{
        plan: :plus,
        interval: :yearly,
        status: :active,
        cancel_at_period_end: true
      }

      assert {:ok, %UserSubscription{} = updated} = Billing.update_user_subscription(scope, update_attrs)
      assert updated.id == subscription.id
      assert updated.user_id == user.id
      assert updated.org_id == org.id
      assert updated.plan == :plus
      assert updated.interval == :yearly
      assert updated.status == :active
      assert updated.cancel_at_period_end == true
    end

    test "cannot override user_id from scope when updating" do
      user = user_fixture()
      another_user = user_fixture()
      org = org_fixture()
      subscription = user_subscription_fixture(%{user: user, org: org})
      scope = %Scope{user: user, org: org, subscription: subscription}

      # Attempt to update user_id
      update_attrs = %{user_id: another_user.id}

      assert {:ok, %UserSubscription{} = updated} = Billing.update_user_subscription(scope, update_attrs)
      # Should remain unchanged
      assert updated.user_id == user.id
    end

    test "cannot override org_id from scope when updating" do
      user = user_fixture()
      org = org_fixture()
      another_org = org_fixture()
      subscription = user_subscription_fixture(%{user: user, org: org})
      scope = %Scope{user: user, org: org, subscription: subscription}

      # Attempt to update org_id
      update_attrs = %{org_id: another_org.id}

      assert {:ok, %UserSubscription{} = updated} = Billing.update_user_subscription(scope, update_attrs)
      # Should remain unchanged
      assert updated.org_id == org.id
    end

    test "returns error with invalid data when updating" do
      user = user_fixture()
      org = org_fixture()
      subscription = user_subscription_fixture(%{user: user, org: org})
      scope = %Scope{user: user, org: org, subscription: subscription}

      # Invalid status
      invalid_attrs = %{status: :invalid_status}

      assert {:error, %Ecto.Changeset{}} = Billing.update_user_subscription(scope, invalid_attrs)
    end
  end

  describe "cancel_user_subscription/1" do
    test "successfully cancels a subscription with Stripe subscription ID" do
      user = user_fixture()
      subscription = user_subscription_fixture(%{user: user, stripe_subscription_id: "sub_12345"})

      scope =
        %{user: user}
        |> scope_fixture()
        |> Map.put(:subscription, subscription)

      stripe_stub(prefix: "/subscriptions/sub_12345", data: %{"status" => "canceled"})

      assert {:ok, canceled_subscription} = Billing.cancel_user_subscription(scope)

      assert canceled_subscription.status == :canceled
      assert canceled_subscription.cancel_at_period_end == true
      assert canceled_subscription.stripe_subscription_id == "sub_12345"
    end

    test "successfully cancels a subscription without Stripe subscription ID" do
      user = user_fixture()
      subscription = user_subscription_fixture(%{user: user, stripe_subscription_id: nil})

      scope =
        %{user: user}
        |> scope_fixture()
        |> Map.put(:subscription, subscription)

      assert {:ok, canceled_subscription} = Billing.cancel_user_subscription(scope)
      assert canceled_subscription.status == :canceled
      assert canceled_subscription.cancel_at_period_end == true
      assert canceled_subscription.stripe_subscription_id == nil
    end

    test "handles Stripe API errors" do
      user = user_fixture()
      subscription = user_subscription_fixture(%{user: user, stripe_subscription_id: "sub_error"})

      scope =
        %{user: user}
        |> scope_fixture()
        |> Map.put(:subscription, subscription)

      stripe_stub(error: true)

      assert {:error, "Invalid request"} = Billing.cancel_user_subscription(scope)
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

      assert_raise Ecto.ConstraintError, fn ->
        Billing.create_billing_account(scope, attrs)
      end
    end

    test "returns error when Stripe customer creation fails" do
      scope = scope_fixture()

      stripe_stub(error: true)

      attrs = %{"currency" => "usd", "country_iso2" => "us"}

      assert {:error, "Invalid request"} = Billing.create_billing_account(scope, attrs)
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

  describe "get_user_from_stripe_customer_id/1" do
    test "returns user when a billing account is found" do
      billing_account = billing_account_fixture()
      user = Billing.get_user_from_stripe_customer_id(billing_account.stripe_customer_id)
      assert user.id == billing_account.user_id
    end

    test "returns nil when no billing account is found" do
      refute Billing.get_user_from_stripe_customer_id("cus_invalid")
    end
  end

  describe "get_user_subscription/1" do
    test "returns active subscription when user has one" do
      user = user_fixture()
      org = org_fixture()
      scope = %Scope{user: user, org: org}

      user_subscription_fixture(%{
        scope: scope,
        status: :canceled,
        expires_at: DateTime.add(DateTime.utc_now(), -30, :day)
      })

      active_subscription =
        user_subscription_fixture(%{
          scope: scope,
          status: :active,
          plan: :plus,
          expires_at: DateTime.add(DateTime.utc_now(), 30, :day)
        })

      result = Billing.get_user_subscription(scope)
      assert result.id == active_subscription.id
      assert result.status == :active
      assert result.plan == :plus
    end

    test "returns latest subscription when no active subscription exists" do
      user = user_fixture()
      org = org_fixture()
      scope = %Scope{user: user, org: org}

      user_subscription_fixture(%{
        scope: scope,
        status: :canceled,
        expires_at: DateTime.add(DateTime.utc_now(), -365, :day)
      })

      newer_subscription =
        user_subscription_fixture(%{
          scope: scope,
          status: :incomplete,
          expires_at: DateTime.add(DateTime.utc_now(), -30, :day)
        })

      result = Billing.get_user_subscription(scope)
      assert result.id == newer_subscription.id
      assert result.status == :incomplete
    end

    test "returns nil when user has no subscriptions" do
      user = user_fixture()
      org = org_fixture()
      scope = %Scope{user: user, org: org}

      refute Billing.get_user_subscription(scope)
    end

    test "returns nil when user exists but org doesn't match" do
      user = user_fixture()
      org = org_fixture()
      scope = %Scope{user: user, org: org}

      other_org = org_fixture()
      other_scope = %Scope{user: user, org: other_org}

      user_subscription_fixture(%{scope: other_scope, status: :active})

      refute Billing.get_user_subscription(scope)
    end
  end

  describe "get_user_subscription_by_stripe_id" do
    test "returns user subscription when found" do
      user_subscription = user_subscription_fixture()
      result = Billing.get_user_subscription_by_stripe_id(user_subscription.stripe_subscription_id)
      assert result.id == user_subscription.id
    end

    test "returns nil when not found" do
      refute Billing.get_user_subscription_by_stripe_id("sub_invalid")
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

  describe "get_customer_tax_ids/1" do
    test "returns tax IDs for customer with billing account" do
      scope = scope_fixture()
      billing_account_fixture(%{"scope" => scope})

      tax_ids = [%{"id" => "txi_123", "type" => "br_cpf", "value" => "12345678901"}]
      stripe_stub(data: %{"data" => tax_ids})

      assert {:ok, %{"data" => ^tax_ids}} = Billing.get_customer_tax_ids(scope)
    end

    test "returns error when no billing account exists" do
      scope = scope_fixture()

      assert {:error, "No billing account found"} = Billing.get_customer_tax_ids(scope)
    end

    test "returns error when Stripe API fails" do
      scope = scope_fixture()
      billing_account_fixture(%{"scope" => scope})
      stripe_stub(error: true)

      assert {:error, "Invalid request"} = Billing.get_customer_tax_ids(scope)
    end
  end

  describe "create_customer_tax_id/2" do
    test "creates tax ID for customer with billing account" do
      scope = scope_fixture()
      billing_account_fixture(%{"scope" => scope})

      attrs = %{"type" => "br_cpf", "value" => "12345678901"}
      stripe_stub(data: %{"type" => "br_cpf", "value" => "12345678901"})

      assert {:ok, %{"type" => "br_cpf", "value" => "12345678901"}} = Billing.create_customer_tax_id(scope, attrs)
    end

    test "returns error when no billing account exists" do
      scope = scope_fixture()
      attrs = %{"type" => "br_cpf", "value" => "12345678901"}

      assert {:error, "No billing account found"} = Billing.create_customer_tax_id(scope, attrs)
    end

    test "returns error when Stripe API fails" do
      scope = scope_fixture()
      billing_account_fixture(%{"scope" => scope})
      attrs = %{"type" => "br_cpf", "value" => "12345678901"}
      stripe_stub(error: true)

      assert {:error, "Invalid request"} = Billing.create_customer_tax_id(scope, attrs)
    end
  end

  describe "customer_has_tax_ids?/1" do
    test "returns true when customer has tax IDs" do
      scope = scope_fixture()
      billing_account_fixture(%{"scope" => scope})

      tax_ids = [%{"id" => "txi_123", "type" => "br_cpf", "value" => "12345678901"}]
      stripe_stub(data: %{"data" => tax_ids})

      assert Billing.customer_has_tax_ids?(scope)
    end

    test "returns false when customer has no tax IDs" do
      scope = scope_fixture()
      billing_account_fixture(%{"scope" => scope})

      stripe_stub(data: %{"data" => []})

      refute Billing.customer_has_tax_ids?(scope)
    end

    test "returns false when no billing account exists" do
      scope = scope_fixture()

      refute Billing.customer_has_tax_ids?(scope)
    end

    test "returns false when Stripe API fails" do
      scope = scope_fixture()
      billing_account_fixture(%{"scope" => scope})
      stripe_stub(error: true)

      refute Billing.customer_has_tax_ids?(scope)
    end
  end
end
