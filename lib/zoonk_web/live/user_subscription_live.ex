defmodule ZoonkWeb.UserSubscriptionLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.UserSubscriptionForm

  alias Zoonk.Billing
  alias Zoonk.Billing.BillingAccount
  alias Zoonk.Billing.UserSubscription
  alias Zoonk.Locations.CountryData
  alias Zoonk.Scope

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

        <.subscription_form
          current_plan={@current_plan}
          selected_plan={@selected_plan}
          period={@period}
          prices={@prices}
        />
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
    scope = socket.assigns.scope
    billing_account = Billing.get_billing_account(scope)
    country_changeset = Billing.change_billing_account_form(%BillingAccount{}, %{})

    socket =
      socket
      |> assign(:page_title, dgettext("page_title", "Subscription"))
      |> assign(:billing_account, billing_account)
      |> assign(:country_form, to_form(country_changeset))
      |> assign(:period, :monthly)
      |> assign(:selected_plan, current_plan(scope))
      |> assign(:current_plan, current_plan(scope))
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
        {:noreply,
         socket
         |> assign(:billing_account, billing_account)
         |> assign(:prices, list_prices(billing_account))}

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

  defp list_prices(nil), do: []

  defp list_prices(%BillingAccount{} = billing_account) do
    case Billing.list_prices(billing_account) do
      {:ok, prices} -> prices
      _error -> []
    end
  end

  defp current_plan(%Scope{subscription: %UserSubscription{status: :active, plan: plan}}), do: plan
  defp current_plan(_scope), do: :free
end
