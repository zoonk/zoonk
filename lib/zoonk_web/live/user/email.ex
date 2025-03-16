defmodule ZoonkWeb.Live.UserEmail do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Accounts

  def render(assigns) do
    ~H"""
    <.form_container
      for={@email_form}
      id="email_form"
      phx-submit="update_email"
      phx-change="validate_email"
      class="zk-container-inner"
    >
      <:title>{dgettext("users", "Change Email")}</:title>

      <:subtitle>
        {dgettext(
          "users",
          "This is the email address that will be used to sign in. This is not visible to other users."
        )}
      </:subtitle>

      <.input type="hidden" field={@email_form[:provider]} />

      <.input
        id="user-email"
        field={@email_form[:identity_id]}
        label={dgettext("users", "Email address")}
        type="email"
        autocomplete="username"
        required
        hide_label
      />

      <:requirements>
        {dgettext("users", "You'll need to confirm your email address.")}
      </:requirements>
    </.form_container>
    """
  end

  def mount(%{"token" => token}, _session, socket) do
    socket =
      case Accounts.update_user_email(socket.assigns.current_scope.user_identity, token) do
        :ok ->
          put_flash(socket, :info, dgettext("users", "Email changed successfully."))

        :error ->
          put_flash(socket, :error, dgettext("users", "Email change link is invalid or it has expired."))
      end

    {:ok, push_navigate(socket, to: ~p"/user/email", layout: {ZoonkWeb.Layouts, :user_settings})}
  end

  def mount(_params, _session, socket) do
    user_identity = socket.assigns.current_scope.user_identity
    identity_changeset = Accounts.change_user_identity(user_identity, %{provider: :email})

    socket =
      socket
      |> assign(:current_email, user_identity.identity_id)
      |> assign(:email_form, to_form(identity_changeset, as: "user"))
      |> assign(:trigger_submit, false)
      |> assign(:page_title, dgettext("users", "Email Settings"))

    {:ok, socket, layout: {ZoonkWeb.Layouts, :user_settings}}
  end

  def handle_event("validate_email", params, socket) do
    %{"user" => user_params} = params

    email_form =
      socket.assigns.current_scope.user_identity
      |> Accounts.change_user_identity(user_params)
      |> Map.put(:action, :validate)
      |> to_form(as: "user")

    {:noreply, assign(socket, email_form: email_form)}
  end

  def handle_event("update_email", params, socket) do
    %{"user" => user_params} = params
    user_identity = socket.assigns.current_scope.user_identity
    true = Accounts.sudo_mode?(user_identity)

    case Accounts.change_user_identity(user_identity, user_params) do
      %{valid?: true} = changeset ->
        user_changeset = Ecto.Changeset.apply_action!(changeset, :insert)

        Accounts.deliver_user_update_email_instructions(
          user_changeset,
          user_identity.identity_id,
          &url(~p"/user/email/confirm/#{&1}")
        )

        info = dgettext("users", "A link to confirm your email change has been sent to the new address.")
        {:noreply, put_flash(socket, :info, info)}

      changeset ->
        {:noreply, assign(socket, :email_form, to_form(changeset, as: "user", action: :insert))}
    end
  end
end
