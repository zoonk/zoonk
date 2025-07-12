defmodule ZoonkWeb.EmailLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Accounts

  on_mount {ZoonkWeb.UserAuthorization, :ensure_org_member}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.SettingsLayout.render
      flash={@flash}
      scope={@scope}
      current_page={:email}
      has_form={true}
      form_id="email_form"
      save_label={dgettext("settings", "Send verification code")}
    >
      <.form_container
        for={@email_form}
        id="email_form"
        phx-submit="submit"
        phx-change="validate_email"
      >
        <:title>{dgettext("settings", "Change Email")}</:title>

        <:subtitle>
          {dgettext(
            "settings",
            "This is the email address that will be used to sign in. This is not visible to other users."
          )}
        </:subtitle>

        <.input
          id="user-email"
          field={@email_form[:email]}
          label={dgettext("settings", "Email address")}
          type="email"
          autocomplete="username"
          required
          hide_label
        />
      </.form_container>
    </ZoonkWeb.SettingsLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    user = socket.assigns.scope.user
    email_changeset = Accounts.change_user_email(user, %{}, validate_email: false)

    socket =
      socket
      |> assign(:current_email, user.email)
      |> assign(:email_form, to_form(email_changeset))
      |> assign(:page_title, dgettext("page_title", "Change Email"))

    {:ok, socket}
  end

  @impl Phoenix.LiveView
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
