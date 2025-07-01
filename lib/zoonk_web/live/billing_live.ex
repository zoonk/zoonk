defmodule ZoonkWeb.BillingLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Billing
  alias Zoonk.Billing.BillingForm
  alias Zoonk.Locations

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render flash={@flash} scope={@scope}>
      <.form_layout>
        <.form_container
          for={@billing_form}
          id="billing_form"
          phx-submit="submit"
          phx-change="validate"
        >
          <:title>{dgettext("billing", "Set up billing account")}</:title>

          <:subtitle>
            {dgettext(
              "billing",
              "We need some billing information to process payments and manage your subscription."
            )}
          </:subtitle>

          <.input
            id="country"
            field={@billing_form[:country_iso2]}
            label={dgettext("billing", "Country")}
            type="select"
            options={@country_options}
            required
            hide_label
            phx-change="country_changed"
          />

          <.input
            id="currency"
            field={@billing_form[:currency]}
            label={dgettext("billing", "Currency")}
            type="select"
            options={@currency_options}
            required
            hide_label
          />

          <.input
            :if={@tax_id_type_options != []}
            id="tax_id_type"
            field={@billing_form[:tax_id_type]}
            label={dgettext("billing", "Tax ID Type")}
            type="select"
            options={[{"", "Select tax ID type"} | @tax_id_type_options]}
            hide_label
            phx-change="tax_id_type_changed"
          />

          <.input
            :if={@show_tax_id_input}
            id="tax_id"
            field={@billing_form[:tax_id]}
            label={dgettext("billing", "Tax ID")}
            type="text"
            placeholder={dgettext("billing", "Enter your tax ID")}
            hide_label
          />

          <.input
            id="address_line_1"
            field={@billing_form[:address_line_1]}
            label={dgettext("billing", "Address Line 1")}
            type="text"
            placeholder={dgettext("billing", "Street address")}
            hide_label
          />

          <.input
            id="address_line_2"
            field={@billing_form[:address_line_2]}
            label={dgettext("billing", "Address Line 2")}
            type="text"
            placeholder={dgettext("billing", "Apartment, suite, etc. (optional)")}
            hide_label
          />

          <.input
            id="city"
            field={@billing_form[:city]}
            label={dgettext("billing", "City")}
            type="text"
            placeholder={dgettext("billing", "City")}
            hide_label
          />

          <.input
            id="state"
            field={@billing_form[:state]}
            label={dgettext("billing", "State/Province")}
            type="text"
            placeholder={dgettext("billing", "State or province")}
            hide_label
          />

          <.input
            id="postal_code"
            field={@billing_form[:postal_code]}
            label={dgettext("billing", "Postal Code")}
            type="text"
            placeholder={dgettext("billing", "Postal code")}
            hide_label
          />

          <:requirements>
            {dgettext("billing", "Only country and currency are required. Other fields help with tax compliance.")}
          </:requirements>
        </.form_container>
      </.form_layout>
    </ZoonkWeb.AppLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(params, _session, socket) do
    user = socket.assigns.scope.user

    # Check if user already has a billing account
    if Billing.has_billing_account?(user) do
      # Redirect to referrer or subscription page
      referrer = Map.get(params, "referrer")
      redirect_to = if referrer && referrer != "", do: referrer, else: ~p"/subscription"

      {:ok, push_navigate(socket, to: redirect_to)}
    else
      billing_changeset = BillingForm.changeset(%BillingForm{}, %{})

      country_options = get_country_options()
      currency_options = get_currency_options()

      socket =
        socket
        |> assign(:billing_form, to_form(billing_changeset))
        |> assign(:country_options, country_options)
        |> assign(:currency_options, currency_options)
        |> assign(:tax_id_type_options, [])
        |> assign(:show_tax_id_input, false)
        |> assign(:page_title, dgettext("page_title", "Set up billing"))

      {:ok, socket}
    end
  end

  @impl Phoenix.LiveView
  def handle_event("validate", params, socket) do
    %{"billing_form" => billing_params} = params

    billing_form =
      %BillingForm{}
      |> BillingForm.changeset(billing_params)
      |> Map.put(:action, :validate)
      |> to_form()

    {:noreply, assign(socket, billing_form: billing_form)}
  end

  def handle_event("country_changed", params, socket) do
    %{"billing_form" => %{"country_iso2" => country_iso2}} = params

    # Update currency default and tax ID type options
    default_currency = Locations.get_country_currency(country_iso2)
    tax_id_type_options = Locations.list_tax_id_types(country_iso2)

    # Get current form data and update with new defaults
    current_data = form_to_params(socket.assigns.billing_form)
      |> Map.put("country_iso2", country_iso2)
      |> Map.put("currency", default_currency || "")

    billing_form =
      %BillingForm{}
      |> BillingForm.changeset(current_data)
      |> Map.put(:action, :validate)
      |> to_form()

    socket =
      socket
      |> assign(:billing_form, billing_form)
      |> assign(:tax_id_type_options, tax_id_type_options)
      |> assign(:show_tax_id_input, false)

    {:noreply, socket}
  end

  def handle_event("tax_id_type_changed", params, socket) do
    %{"billing_form" => %{"tax_id_type" => tax_id_type}} = params

    show_tax_id_input = tax_id_type != ""

    {:noreply, assign(socket, :show_tax_id_input, show_tax_id_input)}
  end

  def handle_event("submit", params, socket) do
    %{"billing_form" => billing_params} = params
    user = socket.assigns.scope.user

    case BillingForm.changeset(%BillingForm{}, billing_params) do
      %{valid?: true} = changeset ->
        form_data = Ecto.Changeset.apply_action!(changeset, :insert)

        case Billing.create_billing_account_with_stripe_data(user, form_data) do
          {:ok, _billing_account} ->
            {:noreply, push_navigate(socket, to: ~p"/subscription")}

          {:error, changeset} ->
            {:noreply, assign(socket, :billing_form, to_form(changeset, action: :insert))}
        end

      changeset ->
        {:noreply, assign(socket, :billing_form, to_form(changeset, action: :insert))}
    end
  end

  defp get_country_options do
    Locations.list_countries()
    |> Enum.map(&{&1.name, &1.iso2})
    |> Enum.sort_by(&elem(&1, 0))
  end

  defp get_currency_options do
    Locations.list_currencies()
    |> Enum.map(fn {code, name} -> {"#{code} - #{name}", code} end)
  end

  defp form_to_params(form) do
    form.params || %{}
  end
end