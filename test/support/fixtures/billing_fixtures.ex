defmodule Zoonk.BillingFixtures do
  @moduledoc false

  import Zoonk.AccountFixtures
  import Zoonk.OrgFixtures

  alias Zoonk.Billing
  alias Zoonk.Scope

  def stripe_stub(opts \\ [])

  def stripe_stub(error: true) do
    Req.Test.stub(:stripe_client, fn conn ->
      Req.Test.json(conn, %{"error" => %{"message" => "Invalid request"}})
    end)
  end

  def stripe_stub(opts) do
    prefix = Keyword.get(opts, :prefix, "/cust_")
    id = "#{prefix}#{System.unique_integer([:positive])}"

    data =
      opts
      |> Keyword.get(:data, %{})
      |> Map.put("id", id)

    Req.Test.stub(:stripe_client, &handle_stripe_endpoint(&1, data))
  end

  defp handle_stripe_endpoint(%{request_path: "/v1/prices"} = conn, _data) do
    Req.Test.json(conn, stripe_prices())
  end

  defp handle_stripe_endpoint(conn, data) do
    Req.Test.json(conn, data)
  end

  @doc """
  Generates a valid user subscription attribute map.

  ## Examples

      iex> valid_user_subscription_attrs()
      %{plan: :plus, payment_term: :monthly, ...}

      iex> valid_user_subscription_attrs(%{plan: :plus})
      %{plan: :plus, payment_term: :monthly, ...}

  """
  def valid_user_subscription_attrs(attrs \\ %{}) do
    expires_at = Map.get(attrs, :expires_at, DateTime.add(DateTime.utc_now(), 30, :day))

    Enum.into(attrs, %{
      plan: :plus,
      payment_term: :monthly,
      status: :active,
      expires_at: expires_at,
      cancel_at_period_end: false,
      stripe_subscription_id: "sub_#{System.unique_integer([:positive])}"
    })
  end

  @doc """
  Creates a user subscription for testing.

  ## Examples

      iex> user_subscription_fixture()
      %UserSubscription{}

      iex> user_subscription_fixture(%{plan: :plus})
      %UserSubscription{plan: :plus}

  """
  def user_subscription_fixture(attrs \\ %{}) do
    user = Map.get_lazy(attrs, :user, fn -> user_fixture() end)
    org = Map.get_lazy(attrs, :org, fn -> org_fixture() end)
    scope = Map.get_lazy(attrs, :scope, fn -> %Scope{user: user, org: org} end)

    attrs = valid_user_subscription_attrs(attrs)

    {:ok, subscription} = Billing.create_user_subscription(scope, attrs)
    subscription
  end

  @doc """
  Generates a valid billing account attribute map.

  ## Examples

      iex> valid_billing_account_attrs()
      %{"currency" => "USD", "country_iso2" => "US"}

      iex> valid_billing_account_attrs(%{"currency" => "EUR"})
      %{"currency" => "EUR", "country_iso2" => "US"}

  """
  def valid_billing_account_attrs(attrs \\ %{}) do
    Map.merge(%{"currency" => "USD", "country_iso2" => "US"}, attrs)
  end

  @doc """
  Creates a billing account for testing.

  ## Examples

      iex> billing_account_fixture()
      %BillingAccount{}

      iex> billing_account_fixture(%{currency: "EUR"})
      %BillingAccount{currency: "EUR"}

  """
  def billing_account_fixture(attrs \\ %{}) do
    scope = Map.get_lazy(attrs, "scope", fn -> scope_fixture() end)
    attrs = valid_billing_account_attrs(attrs)

    # Set up Stripe stub for the customer creation
    stripe_stub(
      prefix: "cus_",
      data: %{
        "email" => scope.user.email,
        "metadata" => %{"user_id" => to_string(scope.user.id)},
        "preferred_locales" => [to_string(scope.user.language)],
        "object" => "customer"
      }
    )

    {:ok, billing_account} = Billing.create_billing_account(scope, attrs)
    billing_account
  end

  defp stripe_prices do
    %{
      "data" => [
        %{
          "id" => "price_plus_monthly",
          "lookup_key" => "plus_monthly",
          "currency_options" => %{
            "usd" => %{"unit_amount" => 1000},
            "brl" => %{"unit_amount" => 5000}
          }
        },
        %{
          "id" => "price_plus_yearly",
          "lookup_key" => "plus_yearly",
          "currency_options" => %{
            "usd" => %{"unit_amount" => 10_000},
            "brl" => %{"unit_amount" => 500_000}
          }
        }
      ]
    }
  end
end
