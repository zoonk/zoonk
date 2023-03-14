defmodule ZoonkWeb.UserConfirmationLive do
  use ZoonkWeb, :live_view

  alias Zoonk.Accounts

  def render(%{live_action: :edit} = assigns) do
    ~H"""
    <div class="mx-auto max-w-sm">
      <.header class="text-center"><%= dgettext("auth", "Confirm Account") %></.header>

      <.simple_form for={@form} id="confirmation_form" phx-submit="confirm_account">
        <.input field={@form[:token]} type="hidden" />

        <:actions>
          <.button phx-disable-with={gettext("Confirming...")} class="w-full">
            <%= dgettext("auth", "Confirm my account") %>
          </.button>
        </:actions>
      </.simple_form>

      <p class="text-center mt-4">
        <.link href={~p"/users/register"}><%= dgettext("auth", "Register") %></.link>
        |
        <.link href={~p"/users/log_in"}><%= dgettext("auth", "Log in") %></.link>
      </p>
    </div>
    """
  end

  def mount(%{"token" => token}, _session, socket) do
    form = to_form(%{"token" => token}, as: "user")

    socket =
      socket |> assign(:page_title, dgettext("auth", "Confirm Account")) |> assign(form: form)

    {:ok, socket, temporary_assigns: [form: nil]}
  end

  # Do not log in the user after confirmation to avoid a
  # leaked token giving the user access to the account.
  def handle_event("confirm_account", %{"user" => %{"token" => token}}, socket) do
    case Accounts.confirm_user(token) do
      {:ok, _} ->
        {:noreply,
         socket
         |> put_flash(:info, dgettext("auth", "User confirmed successfully."))
         |> redirect(to: ~p"/")}

      :error ->
        # If there is a current user and the account was already confirmed,
        # then odds are that the confirmation link was already visited, either
        # by some automation or by the user themselves, so we redirect without
        # a warning message.
        case socket.assigns do
          %{current_user: %{confirmed_at: confirmed_at}} when not is_nil(confirmed_at) ->
            {:noreply, redirect(socket, to: ~p"/")}

          %{} ->
            {:noreply,
             socket
             |> put_flash(
               :error,
               dgettext("auth", "User confirmation link is invalid or it has expired.")
             )
             |> redirect(to: ~p"/users/log_in")}
        end
    end
  end
end
