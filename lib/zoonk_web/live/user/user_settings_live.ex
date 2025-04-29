defmodule ZoonkWeb.User.UserSettingsLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Accounts

  def render(assigns) do
    ~H"""
    <main class="min-h-dvh flex flex-col gap-8 p-4">
      <nav class="flex items-center justify-between">
        <.back_link navigate={~p"/"} />

        <.a
          kind={:button}
          icon="tabler-logout"
          variant={:destructive}
          method="delete"
          href={~p"/logout"}
        >
          {gettext("Logout")}
        </.a>
      </nav>

      <section class="lg:mx-auto lg:max-w-3xl">
        <.form_container
          for={@email_form}
          id="email_form"
          phx-submit="submit"
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
            {dgettext("users", "We'll send a code to your email address.")}
          </:requirements>
        </.form_container>
      </section>

      <.flash_group flash={@flash} />
    </main>
    """
  end

  def mount(_params, _session, socket) do
    user = socket.assigns.scope.user
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
      socket.assigns.scope.user
      |> Accounts.change_user_email(user_params, validate_email: false)
      |> Map.put(:action, :validate)
      |> to_form()

    {:noreply, assign(socket, email_form: email_form)}
  end

  def handle_event("submit", params, socket) do
    %{"user" => user_params} = params
    user = socket.assigns.scope.user

    case Accounts.change_user_email(user, user_params) do
      %{valid?: true} = changeset ->
        user_changeset = Ecto.Changeset.apply_action!(changeset, :insert)

        Accounts.deliver_user_update_email_instructions(user_changeset, user.email)

        {:noreply, push_navigate(socket, to: ~p"/confirm/email")}

      changeset ->
        {:noreply, assign(socket, :email_form, to_form(changeset, action: :insert))}
    end
  end
end
