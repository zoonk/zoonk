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
      <.form_layout>
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

          <.input
            id="billing-country"
            field={@billing_form[:country_iso2]}
            label={dgettext("settings", "Country")}
            type="select"
            options={country_options()}
            prompt={dgettext("settings", "Select your country")}
            required
          />

          <.input
            id="billing-currency"
            field={@billing_form[:currency]}
            label={dgettext("settings", "Currency")}
            type="select"
            options={currency_options()}
            prompt={dgettext("settings", "Select currency")}
            required
          />

          <.input
            id="billing-address-line-1"
            field={@billing_form[:address_line_1]}
            label={dgettext("settings", "Address line 1")}
            type="text"
            placeholder={dgettext("settings", "Enter your address")}
          />

          <.input
            id="billing-address-line-2"
            field={@billing_form[:address_line_2]}
            label={dgettext("settings", "Address line 2")}
            type="text"
            placeholder={dgettext("settings", "Apartment, suite, etc. (optional)")}
          />

          <.input
            id="billing-city"
            field={@billing_form[:city]}
            label={dgettext("settings", "City")}
            type="text"
            placeholder={dgettext("settings", "Enter your city")}
          />

          <.input
            id="billing-state"
            field={@billing_form[:state]}
            label={dgettext("settings", "State/Province")}
            type="text"
            placeholder={dgettext("settings", "Enter your state or province")}
          />

          <.input
            id="billing-postal-code"
            field={@billing_form[:postal_code]}
            label={dgettext("settings", "Postal code")}
            type="text"
            placeholder={dgettext("settings", "Enter your postal code")}
          />

          <.input
            :if={@tax_id_type_options != []}
            id="billing-tax-id-type"
            field={@billing_form[:tax_id_type]}
            label={dgettext("settings", "Tax ID type")}
            type="select"
            options={@tax_id_type_options}
            prompt={dgettext("settings", "Select tax ID type")}
          />

          <.input
            :if={@tax_id_type_options != []}
            id="billing-tax-id"
            field={@billing_form[:tax_id]}
            label={dgettext("settings", "Tax ID")}
            type="text"
            placeholder={dgettext("settings", "Enter your tax ID")}
          />

          <:requirements>
            {dgettext("settings", "Only country and currency are required fields.")}
          </:requirements>
        </.form_container>
      </.form_layout>
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
      |> assign(:tax_id_type_options, [])

    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def handle_event("validate_billing", params, socket) do
    %{"billing_account" => billing_params} = params

    # Check if country changed to update tax ID types
    current_country = socket.assigns.billing_form.data.country_iso2
    new_country = billing_params["country_iso2"]

    tax_id_type_options =
      if new_country && new_country != current_country do
        TaxIdData.types_for_country(new_country)
      else
        socket.assigns.tax_id_type_options
      end

    # Update currency based on selected country if country changed
    updated_billing_params =
      if new_country && new_country != current_country do
        country = CountryData.get_country(new_country)
        currency_code = if country, do: country.currency.code

        billing_params
        |> Map.put("currency", currency_code)
        |> Map.delete("tax_id_type")
        |> Map.delete("tax_id")
      else
        billing_params
      end

    billing_form =
      %BillingAccount{}
      |> Billing.change_billing_account_form(updated_billing_params)
      |> Map.put(:action, :validate)
      |> to_form()

    socket =
      socket
      |> assign(:billing_form, billing_form)
      |> assign(:display_success?, false)
      |> assign(:tax_id_type_options, tax_id_type_options)

    {:noreply, socket}
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

  def on_mount(:ensure_no_billing_account, params, _session, socket) do
    redirect_path = params["from"] || ~p"/subscription"

    case Billing.get_billing_account(socket.assigns.scope) do
      %BillingAccount{} ->
        # Redirect if user already has billing account
        socket = Phoenix.LiveView.redirect(socket, to: redirect_path)
        {:halt, socket}

      nil ->
        # Continue with mount and assign redirect path
        socket = Phoenix.Component.assign(socket, :redirect_path, redirect_path)
        {:cont, socket}
    end
  end
end
