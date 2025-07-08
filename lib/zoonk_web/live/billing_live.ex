defmodule ZoonkWeb.BillingLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Billing
  alias Zoonk.Billing.BillingAccount
  alias Zoonk.Billing.TaxIdData
  alias Zoonk.Locations.CountryData

  on_mount {__MODULE__, :ensure_no_billing_account}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render flash={@flash} scope={@scope}>
      <.form_container
        for={@billing_form}
        id="billing_form"
        phx-submit="submit"
        phx-change="validate_billing"
        display_success={@display_success?}
      >
        <:title>{dgettext("settings", "Set up billing account")}</:title>

        <:subtitle>
          {dgettext(
            "settings",
            "Set up your billing information to manage subscriptions and make purchases."
          )}
        </:subtitle>
        
    <!-- Primary information section -->
        <div class="grid grid-cols-2 gap-4">
          <.input
            id="billing-country"
            field={@billing_form[:country_iso2]}
            label={dgettext("settings", "Country")}
            type="select"
            options={country_options()}
            prompt={dgettext("settings", "Select your country")}
            required
            class="w-full"
          />

          <.input
            id="billing-currency"
            field={@billing_form[:currency]}
            label={dgettext("settings", "Currency")}
            type="select"
            options={currency_options()}
            prompt={dgettext("settings", "Select currency")}
            required
            class="w-full"
          />
        </div>
        
    <!-- Address section -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <.input
            id="billing-address-line-1"
            field={@billing_form[:address_line_1]}
            label={dgettext("settings", "Address line 1")}
            type="text"
            placeholder={dgettext("settings", "Enter your address")}
            class="w-full"
          />

          <.input
            id="billing-address-line-2"
            field={@billing_form[:address_line_2]}
            label={dgettext("settings", "Address line 2")}
            type="text"
            placeholder={dgettext("settings", "Apartment, suite, etc. (optional)")}
            class="w-full"
          />
        </div>
        
    <!-- City/state section -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <.input
            id="billing-city"
            field={@billing_form[:city]}
            label={dgettext("settings", "City")}
            type="text"
            placeholder={dgettext("settings", "Enter your city")}
            class="w-full"
          />

          <.input
            id="billing-state"
            field={@billing_form[:state]}
            label={dgettext("settings", "State/Province")}
            type="text"
            placeholder={dgettext("settings", "Enter your state or province")}
            class="w-full"
          />

          <.input
            id="billing-postal-code"
            field={@billing_form[:postal_code]}
            label={dgettext("settings", "Postal code")}
            type="text"
            placeholder={dgettext("settings", "Enter your postal code")}
            class="w-full"
          />
        </div>
        
    <!-- Tax information section -->
        <div
          :if={tax_id_type_options(@billing_form[:country_iso2].value) != []}
          class="grid grid-cols-2 gap-4 md:grid-cols-4"
        >
          <.input
            id="billing-tax-id-type"
            field={@billing_form[:tax_id_type]}
            label={dgettext("settings", "Tax ID type")}
            type="select"
            options={tax_id_type_options(@billing_form[:country_iso2].value)}
            prompt={dgettext("settings", "Select tax ID type")}
            class="w-full"
          />

          <.input
            id="billing-tax-id"
            field={@billing_form[:tax_id]}
            label={dgettext("settings", "Tax ID")}
            type="text"
            placeholder={dgettext("settings", "Enter your tax ID")}
            class="w-full"
          />
        </div>

        <:requirements>
          {dgettext("settings", "Only country and currency are required fields.")}
        </:requirements>
      </.form_container>
    </ZoonkWeb.AppLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    billing_changeset = Billing.change_billing_account_form(%BillingAccount{}, %{})

    socket =
      socket
      |> assign(:billing_form, to_form(billing_changeset))
      |> assign(:display_success?, false)
      |> assign(:page_title, dgettext("page_title", "Set up billing account"))

    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def handle_event("validate_billing", %{"billing_account" => params}, socket) do
    params = maybe_update_currency(params)

    billing_form =
      %BillingAccount{}
      |> Billing.change_billing_account_form(params)
      |> Map.put(:action, :validate)
      |> to_form()

    {:noreply,
     socket
     |> assign(:billing_form, billing_form)
     |> assign(:display_success?, false)}
  end

  def handle_event("submit", %{"billing_account" => billing_params}, socket) do
    case Billing.create_billing_account(socket.assigns.scope, billing_params) do
      {:ok, _billing_account} ->
        {:noreply, push_navigate(socket, to: socket.assigns.redirect_path)}

      {:error, _changeset} ->
        form_changeset = Billing.change_billing_account_form(%BillingAccount{}, billing_params)
        {:noreply, assign(socket, :billing_form, to_form(form_changeset, action: :insert))}
    end
  end

  defp country_options do
    CountryData.list_countries()
    |> Enum.map(&{&1.name, &1.iso2})
    |> Enum.sort_by(&elem(&1, 0))
  end

  defp currency_options do
    Enum.map(Billing.get_unique_currencies(), &{"#{&1.name} (#{&1.code})", &1.code})
  end

  # Only update currency if it is not already set
  defp maybe_update_currency(%{"country_iso2" => iso2, "currency" => ""} = params) when iso2 != "" do
    currency_code =
      iso2
      |> CountryData.get_country()
      |> then(&(&1 && &1.currency.code))

    Map.put(params, "currency", currency_code)
  end

  defp maybe_update_currency(params), do: params

  defp tax_id_type_options(country_iso2) when is_binary(country_iso2) do
    TaxIdData.types_for_country(country_iso2)
  end

  defp tax_id_type_options(_country_iso2), do: []

  def on_mount(:ensure_no_billing_account, params, _session, socket) do
    redirect_path = Map.get(params, "from", ~p"/subscription")

    if Billing.get_billing_account(socket.assigns.scope) do
      {:halt, Phoenix.LiveView.redirect(socket, to: redirect_path)}
    else
      {:cont, assign(socket, :redirect_path, redirect_path)}
    end
  end
end
