defmodule Zoonk.Billing do
  @moduledoc """
  Handles billing operations for the application.

  This context provides functions for managing subscriptions, processing payments,
  and integrating with payment providers such as Stripe.
  """

  import Zoonk.Helpers, only: [maybe_put: 3]

  alias Zoonk.Billing.BillingAccount
  alias Zoonk.Billing.Price
  alias Zoonk.Billing.Stripe
  alias Zoonk.Billing.UserSubscription
  alias Zoonk.Locations.CountryData
  alias Zoonk.Repo
  alias Zoonk.Scope

  @doc """
  Gets a billing account for a user.

  Returns the billing account if found, otherwise returns nil.

  ## Examples

      iex> user = %Scope{}
      iex> get_billing_account(scope)
      %BillingAccount{}

      iex> user = %Scope{}
      iex> get_billing_account(scope)
      nil
  """
  def get_billing_account(%Scope{} = scope) do
    Repo.get_by(BillingAccount, user_id: scope.user.id)
  end

  @doc """
  Gets unique currencies from all countries.

  Returns a list of unique currencies sorted by their code.

  ## Examples

      iex> get_unique_currencies()
      [%Currency{code: "AED", name: "UAE Dirham"}, %Currency{code: "AFN", name: "Afghan Afghani"}, ...]
  """
  def get_unique_currencies do
    CountryData.list_countries()
    |> Enum.map(& &1.currency)
    |> Enum.uniq_by(& &1.code)
    |> Enum.sort_by(& &1.code)
  end

  @doc """
  Creates a changeset for a billing account form.

  ## Examples

      iex> change_billing_account_form(%BillingAccount{}, %{})
      %Ecto.Changeset{}
  """
  def change_billing_account_form(%BillingAccount{} = billing_account, attrs \\ %{}) do
    BillingAccount.form_changeset(billing_account, attrs)
  end

  @doc """
  Creates a billing account.

  First creates a Stripe customer for the current user,
  then creates the billing account with the Stripe customer ID.

  ## Examples

      iex> create_billing_account(scope, %{currency: "USD", country_iso2: "US"})
      {:ok, %BillingAccount{}}

      iex> create_billing_account(scope, %{})
      {:error, %Ecto.Changeset{}}
  """
  def create_billing_account(%Scope{} = scope, attrs) do
    with {:ok, stripe_customer} <- create_stripe_customer(scope, attrs) do
      attrs =
        attrs
        |> Map.put("stripe_customer_id", stripe_customer["id"])
        |> Map.put("user_id", scope.user.id)

      %BillingAccount{}
      |> BillingAccount.create_changeset(attrs)
      |> Repo.insert()
    end
  end

  @doc """
  Updates a billing account.

  Updates an existing billing account and the associated Stripe customer
  with new attributes.

  ## Examples

      iex> update_billing_account(scope, billing_account, %{currency: "EUR", country_iso2: "FR"})
      {:ok, %BillingAccount{}}

      iex> update_billing_account(scope, billing_account, %{currency: nil})
      {:error, %Ecto.Changeset{}}
  """
  def update_billing_account(%Scope{} = scope, %BillingAccount{} = billing_account, attrs) do
    with {:ok, _stripe_customer} <- update_stripe_customer(scope, attrs) do
      billing_account
      |> BillingAccount.changeset(attrs)
      |> Repo.update()
    end
  end

  @doc """
  Gets a user subscription for the current scope.

  Returns the active subscription for the user and organization in the scope,
  or nil if no active subscription exists.

  ## Examples

      iex> get_user_subscription(%Scope{user: user, org: org})
      %UserSubscription{}

      iex> get_user_subscription(%Scope{user: user, org: org})
      nil
  """
  def get_user_subscription(%Scope{user: user, org: org}) when not is_nil(user) and not is_nil(org) do
    import Ecto.Query

    from(s in UserSubscription,
      where: s.user_id == ^user.id and s.org_id == ^org.id,
      where: s.status in [:active, :trialing, :past_due],
      order_by: [desc: s.inserted_at],
      limit: 1
    )
    |> Repo.one()
  end

  def get_user_subscription(_scope), do: nil

  @doc """
  Creates a user subscription.

  Takes a scope containing the user and org information, along with
  subscription attributes, to create a new user subscription record.

  ## Examples

      iex> create_user_subscription(%Scope{}, %{plan: :plus, payment_term: :monthly})
      {:ok, %UserSubscription{}}

      iex> create_user_subscription(%Scope{}, %{})
      {:error, %Ecto.Changeset{}}
  """
  def create_user_subscription(%Scope{user: user, org: org}, attrs) do
    attrs =
      attrs
      |> Map.merge(%{user_id: user.id, org_id: org.id})
      |> maybe_set_lifetime_expiration()

    %UserSubscription{}
    |> UserSubscription.changeset(attrs)
    |> Repo.insert()
  end

  # Use a far future date (Dec 31, 9999) for lifetime subscriptions
  defp maybe_set_lifetime_expiration(%{payment_term: :lifetime} = attrs) do
    Map.put(attrs, :expires_at, ~U[9999-12-31 23:59:59Z])
  end

  # For non-lifetime subscriptions, keep the original attrs we get from Stripe
  defp maybe_set_lifetime_expiration(attrs), do: attrs

  @doc """
  Creates a Stripe checkout session for subscription or one-time payment.

  ## Examples

      iex> create_checkout_session(%Scope{}, :plus, :monthly)
      {:ok, %{"id" => "cs_1234567890", "url" => "https://checkout.stripe.com/..."}}

      iex> create_checkout_session(%Scope{}, :plus, :lifetime)
      {:ok, %{"id" => "cs_1234567890", "url" => "https://checkout.stripe.com/..."}}

      iex> create_checkout_session(%Scope{}, :invalid, :monthly)
      {:error, "Invalid plan"}
  """
  def create_checkout_session(%Scope{} = scope, plan, payment_term) when plan in [:plus] and payment_term in [:monthly, :yearly, :lifetime] do
    with {:ok, billing_account} <- ensure_billing_account(scope),
         {:ok, prices} <- list_prices(billing_account),
         {:ok, price} <- find_price_for_plan(prices, plan, payment_term) do
      
      mode = if payment_term == :lifetime, do: "payment", else: "subscription"
      
      params = %{
        "customer" => billing_account.stripe_customer_id,
        "mode" => mode,
        "line_items[0][price]" => price.stripe_price_id,
        "line_items[0][quantity]" => 1,
        "success_url" => success_url(scope),
        "cancel_url" => cancel_url(scope),
        "metadata[user_id]" => scope.user.id,
        "metadata[org_id]" => scope.org.id,
        "metadata[plan]" => Atom.to_string(plan),
        "metadata[payment_term]" => Atom.to_string(payment_term)
      }

      Stripe.post("/checkout/sessions", params)
    end
  end

  def create_checkout_session(_scope, _plan, _payment_term) do
    {:error, "Invalid plan or payment term"}
  end

  @doc """
  Creates a Stripe customer portal session for subscription management.

  ## Examples

      iex> create_customer_portal_session(%Scope{})
      {:ok, %{"id" => "bps_1234567890", "url" => "https://billing.stripe.com/..."}}

      iex> create_customer_portal_session(%Scope{})
      {:error, "No billing account found"}
  """
  def create_customer_portal_session(%Scope{} = scope) do
    case get_billing_account(scope) do
      %BillingAccount{stripe_customer_id: stripe_customer_id} ->
        params = %{
          "customer" => stripe_customer_id,
          "return_url" => return_url(scope)
        }

        Stripe.post("/billing_portal/sessions", params)

      nil ->
        {:error, "No billing account found"}
    end
  end

  @doc """
  Updates an existing user subscription.

  Takes a scope containing the user and org information, the subscription to update,
  and the attributes to update.

  The user_id and org_id cannot be changed and will be enforced from the scope.

  ## Examples

      iex> update_user_subscription(%Scope{}, subscription, %{plan: :plus})
      {:ok, %UserSubscription{}}

      iex> update_user_subscription(%Scope{}, subscription, %{})
      {:ok, %UserSubscription{}}

      iex> update_user_subscription(%Scope{}, subscription, %{status: :invalid})
      {:error, %Ecto.Changeset{}}
  """
  def update_user_subscription(%Scope{user: user, org: org}, %UserSubscription{} = subscription, attrs) do
    attrs = Map.merge(attrs, %{user_id: user.id, org_id: org.id})

    subscription
    |> UserSubscription.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Lists all available pricing options for plans filtered by billing account currency.

  Returns a list of prices for all plan options in the billing account's currency.
  If the billing account is nil or the currency is not available in Stripe,
  falls back to USD.

  ## Examples

      iex> list_prices(%BillingAccount{currency: "BRL"})
      {:ok, [%Price{currency: "brl"}]}

      iex> list_prices(%BillingAccount{currency: "CAD"})
      {:ok, [%Price{currency: "usd"}]}

      iex> list_prices(nil)
      {:ok, [%Price{currency: "usd"}]}
  """
  def list_prices(%BillingAccount{currency: currency}) do
    "/prices"
    |> Stripe.get(stripe_price_params())
    |> list_prices(String.downcase(currency))
  end

  def list_prices(nil) do
    list_prices(%BillingAccount{currency: "USD"})
  end

  defp list_prices({:ok, %{"data" => prices}}, currency) do
    {:ok, Enum.map(prices, &Price.transform_from_stripe(&1, currency))}
  end

  defp list_prices({:error, message}, _currency), do: {:error, message}

  defp stripe_price_params do
    [
      {"active", true},
      {"expand[]", "data.currency_options"}
      | Enum.map(stripe_lookup_keys(), &{"lookup_keys[]", &1})
    ]
  end

  defp stripe_lookup_keys do
    ~w[
      plus_monthly    plus_yearly    plus_lifetime
    ]
  end

  @doc """
  Cancels a user subscription.

  Updates the subscription status to `:canceled` and sets `cancel_at_period_end` to `true`.
  Also cancels the subscription in Stripe if a Stripe subscription ID exists.

  ## Examples

      iex> cancel_user_subscription(scope, subscription)
      {:ok, %UserSubscription{}}

      iex> cancel_user_subscription(scope, subscription)
      {:error, %Ecto.Changeset{}}
  """
  def cancel_user_subscription(%Scope{} = scope, %UserSubscription{} = subscription) do
    subscription
    |> cancel_stripe_subscription()
    |> cancel_user_subscription(scope, subscription, %{status: :canceled, cancel_at_period_end: true})
  end

  @doc """
  Creates a customer in Stripe.

  Creates a new customer record in Stripe using the user's
  billing preferences and optional attributes.

  ## Examples

      iex> create_stripe_customer(%Scope{})
      {:ok, %{"id" => "cus_1234567890", "email" => "user@example.com"}}

      iex> create_stripe_customer(%Scope{})
      {:error, "Invalid request"}
  """
  def create_stripe_customer(%Scope{user: user}, attrs \\ %{}) do
    %{
      "email" => user.email,
      "metadata[user_id]" => user.id,
      "preferred_locales[]" => Atom.to_string(user.language)
    }
    |> maybe_put("name", attrs["name"])
    |> maybe_put("phone", attrs["phone"])
    |> maybe_put("address[line1]", attrs["address_line_1"])
    |> maybe_put("address[line2]", attrs["address_line_2"])
    |> maybe_put("address[city]", attrs["city"])
    |> maybe_put("address[state]", attrs["state"])
    |> maybe_put("address[postal_code]", attrs["postal_code"])
    |> maybe_put("address[country]", attrs["country_iso2"])
    |> Map.merge(build_tax_id_attrs(attrs))
    |> then(&Stripe.post("/customers", &1))
  end

  @doc """
  Updates a customer in Stripe.

  Updates an existing customer record in Stripe using the user's
  billing preferences and optional attributes. Gets the Stripe customer ID
  from the user's billing account.

  ## Examples

      iex> update_stripe_customer(%Scope{}, %{"name" => "John Doe"})
      {:ok, %{"id" => "cus_1234567890", "name" => "John Doe"}}

      iex> update_stripe_customer(%Scope{}, %{})
      {:error, "No billing account found"}
  """
  def update_stripe_customer(%Scope{} = scope, attrs \\ %{}) do
    case get_billing_account(scope) do
      %BillingAccount{stripe_customer_id: stripe_customer_id} ->
        attrs
        |> maybe_put("name", attrs["name"])
        |> maybe_put("phone", attrs["phone"])
        |> maybe_put("address[line1]", attrs["address_line_1"])
        |> maybe_put("address[line2]", attrs["address_line_2"])
        |> maybe_put("address[city]", attrs["city"])
        |> maybe_put("address[state]", attrs["state"])
        |> maybe_put("address[postal_code]", attrs["postal_code"])
        |> maybe_put("address[country]", attrs["country_iso2"])
        |> Map.merge(build_tax_id_attrs(attrs))
        |> then(&Stripe.post("/customers/#{stripe_customer_id}", &1))

      nil ->
        {:error, "No billing account found"}
    end
  end

  defp build_tax_id_attrs(%{"tax_id" => id, "tax_id_type" => type}) when is_binary(id) and is_binary(type) do
    %{"tax_id_data[0][type]" => type, "tax_id_data[0][value]" => id}
  end

  defp build_tax_id_attrs(_attrs), do: %{}

  # Helper functions for checkout session creation
  defp ensure_billing_account(%Scope{} = scope) do
    case get_billing_account(scope) do
      %BillingAccount{} = billing_account -> {:ok, billing_account}
      nil -> {:error, "No billing account found"}
    end
  end

  defp find_price_for_plan(prices, plan, payment_term) do
    case Enum.find(prices, &(&1.plan == plan && &1.period == payment_term)) do
      %Price{} = price -> {:ok, price}
      nil -> {:error, "Price not found for plan #{plan} with term #{payment_term}"}
    end
  end

  defp success_url(%Scope{}) do
    base_url() <> "/subscription?success=true"
  end

  defp cancel_url(%Scope{}) do
    base_url() <> "/subscription?canceled=true"
  end

  defp return_url(%Scope{}) do
    base_url() <> "/subscription"
  end

  defp base_url do
    Application.get_env(:zoonk, ZoonkWeb.Endpoint)[:url][:host] 
    |> case do
      "localhost" -> "http://localhost:4000"
      host -> "https://#{host}"
    end
  end

  defp cancel_user_subscription({:ok, _status}, scope, subscription, attrs) do
    update_user_subscription(scope, subscription, attrs)
  end

  defp cancel_user_subscription({:error, message}, _scope, _subscription, _attrs) do
    {:error, message}
  end

  # Don't call the Stripe API if the user isn't using Stripe
  defp cancel_stripe_subscription(%UserSubscription{stripe_subscription_id: nil}) do
    {:ok, %{"status" => "canceled"}}
  end

  # Cancels a Stripe subscription if a subscription ID exists
  defp cancel_stripe_subscription(%UserSubscription{stripe_subscription_id: subscription_id}) do
    Stripe.delete("/subscriptions/#{subscription_id}")
  end
end
