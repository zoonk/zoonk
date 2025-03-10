defmodule ZoonkWeb.Live.UserEmail do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Auth

  on_mount {ZoonkWeb.Hooks.UserAuth, :ensure_sudo_mode}

  def render(assigns) do
    ~H"""
    <.simple_form
      for={@email_form}
      id="email_form"
      phx-submit="update_email"
      phx-change="validate_email"
    >
      <.input
        field={@email_form[:email]}
        type="email"
        label={dgettext("users", "Email")}
        autocomplete="username"
        required
      />

      <.button type="submit" phx-disable-with={dgettext("users", "Changing...")}>
        {dgettext("users", "Change Email")}
      </.button>
    </.simple_form>
    """
  end

  def mount(%{"token" => token}, _session, socket) do
    socket =
      case Auth.update_user_email(socket.assigns.current_scope.user, token) do
        :ok ->
          put_flash(socket, :info, dgettext("users", "Email changed successfully."))

        :error ->
          put_flash(socket, :error, dgettext("users", "Email change link is invalid or it has expired."))
      end

    {:ok, push_navigate(socket, to: ~p"/user/email", layout: {ZoonkWeb.Layouts, :user_settings})}
  end

  def mount(_params, _session, socket) do
    user = socket.assigns.current_scope.user
    email_changeset = Auth.change_user_email(user, %{}, validate_email: false)

    socket =
      socket
      |> assign(:current_email, user.email)
      |> assign(:email_form, to_form(email_changeset))
      |> assign(:trigger_submit, false)
      |> assign(:page_title, dgettext("users", "Change Email"))

    {:ok, socket, layout: {ZoonkWeb.Layouts, :user_settings}}
  end

  def handle_event("validate_email", params, socket) do
    %{"user" => user_params} = params

    email_form =
      socket.assigns.current_scope.user
      |> Auth.change_user_email(user_params, validate_email: false)
      |> Map.put(:action, :validate)
      |> to_form()

    {:noreply, assign(socket, email_form: email_form)}
  end

  def handle_event("update_email", params, socket) do
    %{"user" => user_params} = params
    user = socket.assigns.current_scope.user
    true = Auth.sudo_mode?(user)

    case Auth.change_user_email(user, user_params) do
      %{valid?: true} = changeset ->
        user_changeset = Ecto.Changeset.apply_action!(changeset, :insert)

        Auth.deliver_user_update_email_instructions(
          user_changeset,
          user.email,
          &url(~p"/user/email/confirm/#{&1}")
        )

        info = dgettext("users", "A link to confirm your email change has been sent to the new address.")
        {:noreply, put_flash(socket, :info, info)}

      changeset ->
        {:noreply, assign(socket, :email_form, to_form(changeset, action: :insert))}
    end
  end
end
