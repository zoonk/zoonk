defmodule ZoonkWeb.UserRegistrationLive do
  use ZoonkWeb, :live_view

  import ZoonkWeb.Components.User

  alias Zoonk.Accounts
  alias Zoonk.Accounts.User

  def render(assigns) do
    ~H"""
    <.auth_container>
      <.auth_header>
        <%= dgettext("auth", "Register for an account") %>
        <:description>
          <%= dgettext("auth", "Already registered?") %>
          <.link_styled navigate={~p"/users/log_in"}><%= dgettext("auth", "Sign in") %></.link_styled>
        </:description>
      </.auth_header>

      <.simple_form
        for={@form}
        id="registration_form"
        phx-submit="save"
        phx-change="validate"
        phx-trigger-action={@trigger_submit}
        action={~p"/users/log_in?_action=registered"}
        method="post"
      >
        <.header>
          <%= dgettext("auth", "Basic information") %>

          <:subtitle>
            <%= dgettext(
              "auth",
              "This is your profile information. You won't be able to edit your name or date of birth after registration."
            ) %>
          </:subtitle>
        </.header>

        <.error :if={@check_errors}>
          <%= gettext("Oops, something went wrong! Please check the errors below.") %>
        </.error>

        <.input
          field={@form[:first_name]}
          type="text"
          label={dgettext("auth", "First Name")}
          autocomplete="given-name"
          required
        />

        <.input
          field={@form[:last_name]}
          type="text"
          label={dgettext("auth", "Last Name")}
          autocomplete="family-name"
          required
        />

        <.input
          field={@form[:date_of_birth]}
          type="date"
          label={dgettext("auth", "Date of birth")}
          autocomplete="bday"
          required
        />

        <.input
          field={@form[:language]}
          type="select"
          label={dgettext("auth", "Language")}
          options={Zoonk.Language.language_options()}
          value={@current_language}
          required
        />

        <.header>
          <%= dgettext("auth", "Credentials") %>

          <:subtitle>
            <%= dgettext(
              "auth",
              "This is how you access your account. You'll be able to login using either your email address or password."
            ) %>
          </:subtitle>
        </.header>

        <.input
          field={@form[:email]}
          type="email"
          label={dgettext("auth", "Email")}
          autocomplete="email"
          required
        />

        <.input
          field={@form[:username]}
          type="text"
          label={dgettext("auth", "Username")}
          autocomplete="username"
          required
        />

        <.input
          field={@form[:password]}
          type="password"
          label={dgettext("auth", "Password")}
          autocomplete="new-password"
          required
        />

        <:actions>
          <.button phx-disable-with={dgettext("auth", "Creating account...")} class="w-full">
            <%= dgettext("auth", "Create account") %>
          </.button>
        </:actions>
      </.simple_form>
    </.auth_container>
    """
  end

  def mount(_params, session, socket) do
    language = Map.get(session, "language")
    changeset = Accounts.change_user_registration(%User{})

    socket =
      socket
      |> assign(:page_title, dgettext("auth", "Sign up"))
      |> assign(:current_language, language)
      |> assign(trigger_submit: false, check_errors: false)
      |> assign_form(changeset)

    {:ok, socket, temporary_assigns: [form: nil]}
  end

  def handle_event("save", %{"user" => user_params}, socket) do
    case Accounts.register_user(user_params) do
      {:ok, user} ->
        {:ok, _} =
          Accounts.deliver_user_confirmation_instructions(
            user,
            &url(~p"/users/confirm/#{&1}")
          )

        changeset = Accounts.change_user_registration(user)
        {:noreply, socket |> assign(trigger_submit: true) |> assign_form(changeset)}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, socket |> assign(check_errors: true) |> assign_form(changeset)}
    end
  end

  def handle_event("validate", %{"user" => user_params}, socket) do
    changeset = Accounts.change_user_registration(%User{}, user_params)
    {:noreply, assign_form(socket, Map.put(changeset, :action, :validate))}
  end

  defp assign_form(socket, %Ecto.Changeset{} = changeset) do
    form = to_form(changeset, as: "user")

    if changeset.valid? do
      assign(socket, form: form, check_errors: false)
    else
      assign(socket, form: form)
    end
  end
end
