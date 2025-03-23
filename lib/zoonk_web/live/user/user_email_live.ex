defmodule ZoonkWeb.User.UserEmailLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Accounts

  def render(assigns) do
    ~H"""
    <ZoonkWeb.User.UserLayout.render
      user_return_to={@user_return_to}
      flash={@flash}
      page_title={@page_title}
      active_page={:email}
    >
      <.form_container
        for={@email_form}
        id="email_form"
        phx-submit="update_email"
        phx-change="validate_email"
      >
        <:title>{dgettext("users", "Change Email")}</:title>

        <:subtitle>
          {dgettext(
            "users",
            "This is the email address that will be used to sign in. This is not visible to other users."
          )}
        </:subtitle>

        <.input
          id="user-email"
          field={@email_form[:email]}
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
    </ZoonkWeb.User.UserLayout.render>
    """
  end

  def mount(%{"token" => token}, _session, socket) do
    socket =
      case Accounts.update_user_email(socket.assigns.current_scope.user, token) do
        :ok ->
          put_flash(socket, :info, dgettext("users", "Email changed successfully."))

        :error ->
          put_flash(socket, :error, dgettext("users", "Email change link is invalid or it has expired."))
      end

    {:ok, push_navigate(socket, to: ~p"/user/email")}
  end

  def mount(_params, _session, socket) do
    user = socket.assigns.current_scope.user
    email_changeset = Accounts.change_user_email(user, %{}, validate_email: false)

    socket =
      socket
      |> assign(:current_email, user.email)
      |> assign(:email_form, to_form(email_changeset))
      |> assign(:trigger_submit, false)
      |> assign(:page_title, dgettext("users", "Email Settings"))

    {:ok, socket}
  end

  def handle_event("validate_email", params, socket) do
    %{"user" => user_params} = params

    email_form =
      socket.assigns.current_scope.user
      |> Accounts.change_user_email(user_params, validate_email: false)
      |> Map.put(:action, :validate)
      |> to_form()

    {:noreply, assign(socket, email_form: email_form)}
  end

  def handle_event("update_email", params, socket) do
    %{"user" => user_params} = params
    user = socket.assigns.current_scope.user
    true = Accounts.sudo_mode?(user)

    case Accounts.change_user_email(user, user_params) do
      %{valid?: true} = changeset ->
        user_changeset = Ecto.Changeset.apply_action!(changeset, :insert)

        Accounts.deliver_user_update_email_instructions(
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
