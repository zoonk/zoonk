defmodule ZoonkWeb.SubscriptionLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.SubscriptionComponents

  alias Zoonk.Billing
  alias Zoonk.Billing.BillingAccount
  alias Zoonk.Billing.Price
  alias Zoonk.Locations
  alias Zoonk.Locations.CountryData

  on_mount {ZoonkWeb.UserAuthorization, :ensure_org_member}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.SettingsLayout.render flash={@flash} scope={@scope} current_page={:subscription}>
      <section
        :if={@billing_account}
        class="mx-auto flex w-full max-w-lg flex-1 flex-col items-center gap-8 md:max-w-4xl md:py-8"
      >
        <header class="flex flex-col items-center gap-1 text-center">
          <.text tag="h2" size={:xxl} class="tracking-tight md:tracking-tightest">
            {gettext(
              "Subscribe to learn %{open}%{word}%{close}",
              open: ~s(<span class="text-zk-primary-text/70">),
              close: "</span>",
              word: gettext("anything")
            )
            |> raw()}
          </.text>

          <.text size={:md} variant={:secondary}>
            {dgettext("settings", "Get unlimited access to all courses")}
          </.text>
        </header>

        <!-- Current subscription status -->
        <div :if={@subscription} class="w-full max-w-md rounded-lg border border-zk-border bg-zk-surface p-4">
          <div class="flex items-center justify-between">
            <div>
              <.text size={:sm} weight={:semibold}>
                {dgettext("settings", "Current Plan")}
              </.text>
              <.text size={:lg} weight={:bold} class="capitalize">
                {subscription_plan_display(@subscription)} - {subscription_term_display(@subscription)}
              </.text>
              <.text size={:sm} variant={:secondary}>
                {subscription_status_display(@subscription)}
              </.text>
            </div>
            <div class="flex flex-col gap-2">
              <.button
                :if={subscription_can_manage?(@subscription)}
                phx-click="manage_subscription"
                variant={:secondary}
                size={:sm}
              >
                {dgettext("settings", "Manage")}
              </.button>
              <.button
                :if={subscription_can_cancel?(@subscription)}
                phx-click="cancel_subscription"
                variant={:destructive}
                size={:sm}
              >
                {dgettext("settings", "Cancel")}
              </.button>
            </div>
          </div>
        </div>

        <.toggle_group class="w-full max-w-md" phx-change="change_period">
          <.toggle_item value="monthly" name="period" checked={@period == :monthly}>
            {dgettext("settings", "Monthly")}
          </.toggle_item>

          <.toggle_item value="yearly" name="period" checked={@period == :yearly}>
            {dgettext("settings", "Yearly")}
          </.toggle_item>

          <.toggle_item value="lifetime" name="period" checked={@period == :lifetime}>
            {dgettext("settings", "Lifetime")}
          </.toggle_item>
        </.toggle_group>

        <.subscription
          :if={@prices != []}
          phx-submit="subscribe"
          phx-change="change_plan"
          class="w-full max-w-4xl"
        >
          <div class="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
            <.subscription_item
              value="free"
              name="plan"
              label={dgettext("settings", "Free")}
              checked={@selected_plan == :free}
            >
              <.subscription_header>
                <.subscription_title
                  badge_label={badge_label(:free, @current_plan, @period)}
                  badge_color={badge_color(:free, @current_plan)}
                >
                  {dgettext("settings", "Free")}
                </.subscription_title>

                <.subscription_price>
                  {free_plan_price(@prices)}
                </.subscription_price>
              </.subscription_header>

              <.subscription_features>
                <.subscription_feature icon="tabler-book">
                  {dgettext("settings", "Access to all courses")}
                </.subscription_feature>

                <.subscription_feature icon="tabler-calendar">
                  {dgettext("settings", "1 lesson per day")}
                </.subscription_feature>

                <.subscription_feature icon="tabler-refresh">
                  {dgettext("settings", "Regular updates")}
                </.subscription_feature>

                <.subscription_feature icon="tabler-school">
                  {dgettext("settings", "Learn any subject")}
                </.subscription_feature>
              </.subscription_features>
            </.subscription_item>

            <.subscription_item
              value="plus"
              name="plan"
              checked={@selected_plan == :plus}
              label={dgettext("settings", "Plus")}
            >
              <.subscription_header>
                <.subscription_title
                  badge_label={badge_label(:plus, @current_plan, @period)}
                  badge_color={badge_color(:plus, @current_plan)}
                >
                  {dgettext("settings", "Plus")}
                </.subscription_title>

                <.subscription_price
                  :if={find_price(@prices, :plus, @period)}
                  label={period_label(@period)}
                >
                  {find_price(@prices, :plus, @period).value}
                </.subscription_price>
              </.subscription_header>

              <.subscription_features>
                <.subscription_feature icon="tabler-infinity">
                  {dgettext("settings", "Unlimited lessons")}
                </.subscription_feature>

                <.subscription_feature icon="tabler-headset">
                  {dgettext("settings", "Priority support")}
                </.subscription_feature>

                <.subscription_feature icon="tabler-users">
                  {dgettext("settings", "WhatsApp groups")}
                </.subscription_feature>

                <.subscription_feature icon="tabler-check">
                  {dgettext("settings", "Everything in free")}
                </.subscription_feature>
              </.subscription_features>
            </.subscription_item>
          </div>

          <.subscription_submit disclaimer={disclaimer_text(@selected_plan, @period, @prices)}>
            {dgettext("settings", "Subscribe")}
          </.subscription_submit>
        </.subscription>
      </section>

      <section :if={!@billing_account} class="flex flex-1 flex-col gap-4">
        <.text tag="h2" size={:xxl} class="leading-none">
          {dgettext("settings", "Set up billing to manage your subscription")}
        </.text>

        <.text size={:md} variant={:secondary} class="-mt-2">
          {dgettext("settings", "Please select your country to get started with billing setup.")}
        </.text>

        <.form for={@country_form} phx-submit="create_billing_account" class="space-y-4">
          <.input
            field={@country_form[:country_iso2]}
            label={dgettext("settings", "Country")}
            type="select"
            options={country_options()}
            prompt={dgettext("settings", "Select your country")}
            required
            class="w-full md:w-64"
          />

          <.button type="submit">
            {dgettext("settings", "Continue")}
          </.button>
        </.form>
      </section>
    </ZoonkWeb.SettingsLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(params, _session, socket) do
    scope = socket.assigns.scope
    billing_account = Billing.get_billing_account(scope)
    subscription = scope.subscription
    country_changeset = Billing.change_billing_account_form(%BillingAccount{}, %{})

    # Check for success/cancel/error parameters
    show_success = params["success"] == "true"
    show_canceled = params["canceled"] == "true"
    async_payment_error = params["async_payment_error"]

    current_plan = if subscription, do: subscription.plan, else: :free
    
    socket =
      socket
      |> assign(:page_title, dgettext("page_title", "Subscription"))
      |> assign(:billing_account, billing_account)
      |> assign(:subscription, subscription)
      |> assign(:country_form, to_form(country_changeset))
      |> assign(:period, :monthly)
      |> assign(:selected_plan, current_plan)
      |> assign(:current_plan, current_plan)
      |> assign(:prices, list_prices(billing_account))
      |> assign(:show_success, show_success)
      |> assign(:show_canceled, show_canceled)
      |> assign(:async_payment_error, async_payment_error)

    socket =
      socket
      |> maybe_put_flash_for_success(show_success)
      |> maybe_put_flash_for_cancel(show_canceled)
      |> maybe_put_flash_for_async_error(async_payment_error)

    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def handle_event("create_billing_account", %{"billing_account" => %{"country_iso2" => country_iso2}}, socket) do
    # Get the currency for the selected country
    country = CountryData.get_country(country_iso2)
    currency = country && country.currency.code

    billing_params = %{
      "country_iso2" => country_iso2,
      "currency" => currency
    }

    case Billing.create_billing_account(socket.assigns.scope, billing_params) do
      {:ok, billing_account} ->
        {:noreply, assign(socket, :billing_account, billing_account)}

      {:error, _changeset} ->
        {:noreply, put_flash(socket, :error, dgettext("settings", "Failed to create billing account. Please try again."))}
    end
  end

  def handle_event("change_period", %{"period" => period}, socket) do
    {:noreply, assign(socket, :period, String.to_existing_atom(period))}
  end

  def handle_event("change_plan", %{"plan" => plan}, socket) do
    {:noreply, assign(socket, :selected_plan, String.to_existing_atom(plan))}
  end

  def handle_event("subscribe", %{"plan" => plan}, socket) do
    plan_atom = String.to_existing_atom(plan)
    period = socket.assigns.period

    case plan_atom do
      :free ->
        # Handle free plan selection (cancel existing subscription if any)
        handle_free_plan_selection(socket)

      :plus ->
        # Redirect to Stripe checkout for Plus plan
        case Billing.create_checkout_session(socket.assigns.scope, :plus, period) do
          {:ok, %{"url" => checkout_url}} ->
            {:noreply, redirect(socket, external: checkout_url)}

          {:error, reason} ->
            {:noreply, put_flash(socket, :error, dgettext("settings", "Failed to create checkout session: %{reason}", reason: reason))}
        end
    end
  end

  def handle_event("manage_subscription", _params, socket) do
    case Billing.create_customer_portal_session(socket.assigns.scope) do
      {:ok, %{"url" => portal_url}} ->
        {:noreply, redirect(socket, external: portal_url)}

      {:error, reason} ->
        {:noreply, put_flash(socket, :error, dgettext("settings", "Failed to access customer portal: %{reason}", reason: reason))}
    end
  end

  def handle_event("cancel_subscription", _params, socket) do
    case socket.assigns.subscription do
      nil ->
        {:noreply, put_flash(socket, :error, dgettext("settings", "No active subscription to cancel"))}

      subscription ->
        case Billing.cancel_user_subscription(socket.assigns.scope, subscription) do
          {:ok, _canceled_subscription} ->
            {:noreply, 
             socket
             |> put_flash(:info, dgettext("settings", "Your subscription has been canceled. You'll retain access until the end of your billing period."))
             |> push_navigate(to: ~p"/subscription")}

          {:error, reason} ->
            {:noreply, put_flash(socket, :error, dgettext("settings", "Failed to cancel subscription: %{reason}", reason: inspect(reason)))}
        end
    end
  end

  defp handle_free_plan_selection(socket) do
    case socket.assigns.subscription do
      nil ->
        {:noreply, put_flash(socket, :info, dgettext("settings", "You're already on the free plan!"))}

      subscription ->
        case Billing.cancel_user_subscription(socket.assigns.scope, subscription) do
          {:ok, _canceled_subscription} ->
            {:noreply,
             socket
             |> put_flash(:info, dgettext("settings", "Your subscription has been canceled. You'll be downgraded to the free plan at the end of your billing period."))
             |> push_navigate(to: ~p"/subscription")}

          {:error, reason} ->
            {:noreply, put_flash(socket, :error, dgettext("settings", "Failed to downgrade to free plan: %{reason}", reason: inspect(reason)))}
        end
    end
  end

  defp country_options do
    CountryData.list_countries()
    |> Enum.map(&{&1.name, &1.iso2})
    |> Enum.sort_by(&elem(&1, 0))
  end

  defp find_price(prices, plan, period) do
    Enum.find(
      prices,
      &match?(%Price{plan: ^plan, period: ^period}, &1)
    )
  end

  defp list_prices(nil), do: []

  defp list_prices(%BillingAccount{} = billing_account) do
    case Billing.list_prices(billing_account) do
      {:ok, prices} -> prices
      _error -> []
    end
  end

  defp period_label(:monthly), do: dgettext("settings", "/month")
  defp period_label(:yearly), do: dgettext("settings", "/year")
  defp period_label(:lifetime), do: "one-time"

  defp free_plan_price([%Price{currency: currency} | _rest]) do
    symbol = Locations.get_currency_symbol(currency) || "$"
    "#{symbol}0"
  end

  defp free_plan_price(_prices), do: "$0"

  defp disclaimer_text(:free, _period, _prices) do
    dgettext("settings", "This is a limited plan. You will not be charged anything unless you upgrade to a paid plan.")
  end

  defp disclaimer_text(:plus, period, prices) do
    prices
    |> find_price(:plus, period)
    |> Map.get(:value, "$0")
    |> get_price_label(period)
    |> get_plus_disclaimer(period)
  end

  defp get_plus_disclaimer(price_label, period) when period in [:monthly, :yearly] do
    dgettext(
      "settings",
      "Your subscription will renew automatically at %{price}. You can cancel it at any time.",
      price: price_label
    )
  end

  defp get_plus_disclaimer(price_label, :lifetime) do
    dgettext("settings", "You will pay %{price} now and have access to the Plus plan forever.", price: price_label)
  end

  defp get_price_label(price, :monthly), do: dgettext("settings", "%{price}/month", price: price)
  defp get_price_label(price, :yearly), do: dgettext("settings", "%{price}/year", price: price)
  defp get_price_label(price, :lifetime), do: dgettext("settings", "%{price}", price: price)

  defp badge_label(plan, current_plan, _period) when plan == current_plan, do: dgettext("settings", "Current Plan")
  defp badge_label(:plus, _current_plan, :lifetime), do: dgettext("settings", "Limited Time Offer")
  defp badge_label(:plus, _current_plan, :yearly), do: dgettext("settings", "2 Months Free")
  defp badge_label(_plan, _current_plan, _period), do: nil

  defp badge_color(plan, current_plan) when plan == current_plan, do: :secondary
  defp badge_color(_plan, _current_plan), do: :primary

  defp maybe_put_flash_for_success(socket, true) do
    put_flash(socket, :info, dgettext("settings", "Your subscription has been successfully activated!"))
  end

  defp maybe_put_flash_for_success(socket, _), do: socket

  defp maybe_put_flash_for_cancel(socket, true) do
    put_flash(socket, :info, dgettext("settings", "Checkout was canceled. You can try again anytime."))
  end

  defp maybe_put_flash_for_cancel(socket, _), do: socket

  defp maybe_put_flash_for_async_error(socket, error) when is_binary(error) do
    put_flash(socket, :error, dgettext("settings", "Payment processing failed: %{error}. Please try again.", error: error))
  end

  defp maybe_put_flash_for_async_error(socket, _), do: socket

  defp subscription_plan_display(subscription) do
    case subscription.plan do
      :free -> dgettext("settings", "Free")
      :plus -> dgettext("settings", "Plus")
      _ -> dgettext("settings", "Unknown")
    end
  end

  defp subscription_term_display(subscription) do
    case subscription.payment_term do
      :monthly -> dgettext("settings", "Monthly")
      :yearly -> dgettext("settings", "Yearly") 
      :lifetime -> dgettext("settings", "Lifetime")
      _ -> ""
    end
  end

  defp subscription_status_display(subscription) do
    case subscription.status do
      :active -> 
        if subscription.cancel_at_period_end do
          dgettext("settings", "Cancels at period end")
        else
          dgettext("settings", "Active")
        end
      :trialing -> dgettext("settings", "Trial period")
      :past_due -> dgettext("settings", "Payment overdue")
      :canceled -> dgettext("settings", "Canceled")
      :incomplete -> dgettext("settings", "Payment incomplete")
      :incomplete_expired -> dgettext("settings", "Payment expired")
      :unpaid -> dgettext("settings", "Unpaid")
      :paused -> dgettext("settings", "Paused")
      _ -> dgettext("settings", "Unknown status")
    end
  end

  defp subscription_can_manage?(subscription) do
    subscription && subscription.status in [:active, :trialing, :past_due] && subscription.stripe_subscription_id
  end

  defp subscription_can_cancel?(subscription) do
    subscription && subscription.status in [:active, :trialing] && !subscription.cancel_at_period_end
  end
end
