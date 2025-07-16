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

        <.toggle_group class="w-full max-w-md" phx-change="change_period">
          <.toggle_item value="monthly" name="period" checked={@period == :monthly}>
            {dgettext("settings", "Monthly")}
          </.toggle_item>

          <.toggle_item value="yearly" name="period" checked={@period == :yearly}>
            {dgettext("settings", "Yearly")}
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
  def mount(_params, _session, socket) do
    billing_account = Billing.get_billing_account(socket.assigns.scope)
    country_changeset = Billing.change_billing_account_form(%BillingAccount{}, %{})

    socket =
      socket
      |> assign(:page_title, dgettext("page_title", "Subscription"))
      |> assign(:billing_account, billing_account)
      |> assign(:country_form, to_form(country_changeset))
      |> assign(:period, :monthly)
      |> assign(:selected_plan, :free)
      |> assign(:current_plan, :free)
      |> assign(:prices, list_prices(billing_account))

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
    # Placeholder for subscription logic - will redirect to Stripe later
    plan_atom = String.to_existing_atom(plan)

    case plan_atom do
      :free ->
        # Handle free plan subscription (if needed)
        {:noreply, put_flash(socket, :info, dgettext("settings", "You're already on the free plan!"))}

      :plus ->
        # Handle plus plan subscription - will redirect to Stripe checkout
        {:noreply, put_flash(socket, :info, dgettext("settings", "Redirecting to checkout..."))}
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

  defp get_price_label(price, :monthly), do: dgettext("settings", "%{price}/month", price: price)
  defp get_price_label(price, :yearly), do: dgettext("settings", "%{price}/year", price: price)

  defp badge_label(plan, current_plan, _period) when plan == current_plan, do: dgettext("settings", "Current Plan")
  defp badge_label(:plus, _current_plan, :yearly), do: dgettext("settings", "2 Months Free")
  defp badge_label(_plan, _current_plan, _period), do: nil

  defp badge_color(plan, current_plan) when plan == current_plan, do: :secondary
  defp badge_color(_plan, _current_plan), do: :primary
end
