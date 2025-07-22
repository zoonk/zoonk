defmodule Zoonk.BillingFixtures do
  @moduledoc false

  import Zoonk.AccountFixtures
  import Zoonk.OrgFixtures

  alias Zoonk.Billing
  alias Zoonk.Scope

  @doc """
  Creates a Stripe API stub for testing.

  ## Options

    * `:error` - When `true`, returns a Stripe error response
    * `:prefix` - Prefix for generated IDs (default: "/cust_")
    * `:data` - Custom data to return in the response
    * `:capture_to` - PID to send request parameters to for verification

  ## Examples

      # Basic stub
      stripe_stub()

      # Stub with custom data
      stripe_stub(data: %{"url" => "https://checkout.stripe.com/session_123"})

      # Stub that captures request parameters for verification
      stripe_stub(capture_to: self(), data: %{"id" => "cus_123"})

      # Error response
      stripe_stub(error: true)
  """
  def stripe_stub(opts \\ [])

  def stripe_stub(error: true) do
    Req.Test.stub(:stripe_client, fn conn ->
      Req.Test.json(conn, %{"error" => %{"message" => "Invalid request"}})
    end)
  end

  def stripe_stub(opts) do
    prefix = Keyword.get(opts, :prefix, "/cust_")
    id = "#{prefix}#{System.unique_integer([:positive])}"
    capture_pid = Keyword.get(opts, :capture_to)

    data =
      opts
      |> Keyword.get(:data, %{})
      |> Map.put("id", id)

    Req.Test.stub(:stripe_client, fn conn ->
      maybe_capture_request(conn, capture_pid)
      handle_stripe_endpoint(conn, data)
    end)
  end

  defp handle_stripe_endpoint(%{request_path: "/v1/prices"} = conn, _data) do
    Req.Test.json(conn, stripe_prices())
  end

  defp handle_stripe_endpoint(%{request_path: "/v1/checkout/sessions"} = conn, data) do
    data = Enum.into(data, %{"url" => "https://checkout.stripe.com/session_#{System.unique_integer([:positive])}"})

    Req.Test.json(conn, data)
  end

  defp handle_stripe_endpoint(%{request_path: "/v1/billing_portal/sessions"} = conn, data) do
    data = Enum.into(data, %{"url" => "https://billing.stripe.com/p/session_#{System.unique_integer([:positive])}"})
    Req.Test.json(conn, data)
  end

  defp handle_stripe_endpoint(conn, data) do
    Req.Test.json(conn, data)
  end

  defp maybe_capture_request(conn, capture_pid) when is_pid(capture_pid) do
    send(capture_pid, {:stripe_request, conn.body_params})
  end

  defp maybe_capture_request(_conn, _capture_pid), do: :ok

  @doc """
  Generates a valid user subscription attribute map.

  ## Examples

      iex> valid_user_subscription_attrs()
      %{plan: :plus, interval: :monthly, ...}

      iex> valid_user_subscription_attrs(%{plan: :plus})
      %{plan: :plus, interval: :monthly, ...}

  """
  def valid_user_subscription_attrs(attrs \\ %{}) do
    expiration_date =
      DateTime.utc_now()
      |> DateTime.add(30, :day)
      |> DateTime.truncate(:second)

    expires_at = Map.get(attrs, :expires_at, expiration_date)

    Enum.into(attrs, %{
      plan: :plus,
      interval: :monthly,
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
    Map.merge(
      %{
        "currency" => "USD",
        "country_iso2" => "US",
        "stripe_customer_id" => "cus_#{System.unique_integer([:positive])}"
      },
      attrs
    )
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
