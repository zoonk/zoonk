defmodule ZoonkWeb.UserTaxIdLive do
  @moduledoc false

  use ZoonkWeb, :live_view
  use Gettext, backend: Zoonk.Gettext

  alias Zoonk.Billing

  on_mount {ZoonkWeb.UserAuthorization, :ensure_org_member}
  on_mount {__MODULE__, :ensure_brazilian_user}

  def render(assigns) do
    ~H"""
    <main class="bg-zk-background min-h-dvh mx-auto flex max-w-md flex-col items-center justify-center gap-4 p-4">
      <div class="w-full text-left">
        <.text tag="h1" size={:xxl}>
          {dgettext("tax_id", "Add Tax ID to Invoice")}
        </.text>

        <.text tag="p" variant={:secondary}>
          {dgettext("tax_id", "Would you like to include your Tax ID in your invoice?")}
        </.text>
      </div>

      <.form
        for={@form}
        phx-submit="save_tax_id"
        phx-change="validate"
        class="flex w-full flex-col gap-2"
      >
        <.input
          field={@form[:tax_id_type]}
          type="select"
          label={dgettext("tax_id", "Document Type")}
          options={tax_id_type_options()}
          prompt={dgettext("tax_id", "Select type")}
          required
        />

        <.input
          field={@form[:tax_id_value]}
          type="text"
          label={dgettext("tax_id", "Document Number")}
          placeholder={dgettext("tax_id", "Enter your Tax ID number")}
          required
        />

        <div class="mt-2 flex justify-between gap-3">
          <.button type="submit">
            {dgettext("tax_id", "Add")}
          </.button>

          <.a kind={:button} variant={:outline} navigate={~p"/subscription"}>
            {dgettext("tax_id", "Skip")}
          </.a>
        </div>
      </.form>
    </main>
    """
  end

  def mount(_params, _session, socket) do
    changeset = validate_tax_id_form(%{"tax_id_type" => "", "tax_id_value" => ""})
    form = to_form(changeset, as: :tax_id)
    {:ok, assign(socket, form: form)}
  end

  def handle_event("validate", %{"tax_id" => %{"tax_id_type" => type, "tax_id_value" => value}}, socket) do
    changeset = validate_tax_id_form(%{"tax_id_type" => type, "tax_id_value" => value})
    form = to_form(changeset, action: :validate, as: :tax_id)
    {:noreply, assign(socket, form: form)}
  end

  def handle_event("save_tax_id", %{"tax_id" => %{"tax_id_type" => type, "tax_id_value" => value}}, socket) do
    case Billing.create_customer_tax_id(socket.assigns.scope, %{"type" => type, "value" => value}) do
      {:ok, _tax_id} ->
        socket =
          socket
          |> put_flash(:info, dgettext("tax_id", "Tax ID added successfully to your invoices."))
          |> push_navigate(to: ~p"/subscription")

        {:noreply, socket}

      {:error, _reason} ->
        {:noreply, put_flash(socket, :error, dgettext("tax_id", "Failed to add Tax ID. Please try again."))}
    end
  end

  defp tax_id_type_options do
    [
      {"CPF", "br_cpf"},
      {"CNPJ", "br_cnpj"}
    ]
  end

  defp validate_tax_id_form(attrs) do
    types = %{
      tax_id_type: :string,
      tax_id_value: :string
    }

    {%{}, types}
    |> Ecto.Changeset.cast(attrs, [:tax_id_type, :tax_id_value])
    |> Ecto.Changeset.validate_required([:tax_id_type, :tax_id_value])
    |> Ecto.Changeset.validate_inclusion(:tax_id_type, ["br_cpf", "br_cnpj"])
  end

  def on_mount(:ensure_brazilian_user, _params, _session, socket) do
    scope = socket.assigns.scope

    case Billing.get_billing_account(scope) do
      %{country_iso2: "BR"} = _billing_account ->
        if Billing.customer_has_tax_ids?(scope) do
          {:halt, push_navigate(socket, to: ~p"/subscription")}
        else
          {:cont, socket}
        end

      _other ->
        {:halt, push_navigate(socket, to: ~p"/subscription")}
    end
  end
end
