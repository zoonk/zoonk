defmodule ZoonkWeb.SubscriptionLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Billing
  alias Zoonk.Billing.BillingAccount
  alias Zoonk.Locations.CountryData

  on_mount {ZoonkWeb.UserAuthorization, :ensure_org_member}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.SettingsLayout.render flash={@flash} scope={@scope} current_page={:subscription}>
      <section :if={@billing_account}>
        <.text tag="h2" size={:xxl}>
          {dgettext("settings", "Subscribe to learn anything")}
        </.text>
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

  defp country_options do
    CountryData.list_countries()
    |> Enum.map(&{&1.name, &1.iso2})
    |> Enum.sort_by(&elem(&1, 0))
  end
end
