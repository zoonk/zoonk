defmodule ZoonkWeb.Live.UserSignUp do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Auth
  alias ZoonkSchema.User

  def render(assigns) do
    ~H"""
    <div class="mx-auto max-w-sm">
      <.header class="text-center">
        Sign Up
        <:subtitle>
          Already registered?
          <.link navigate={~p"/users/signin"} class="text-brand font-semibold hover:underline">
            Sign in
          </.link>
          to your account now.
        </:subtitle>
      </.header>

      <.simple_form for={@form} id="registration_form" phx-submit="save" phx-change="validate">
        <.error :if={@check_errors}>
          Oops, something went wrong! Please check the errors below.
        </.error>

        <input type="hidden" name={@form[:timezone].name} value={@form[:timezone].value} />
        <input type="hidden" name={@form[:language].name} value={@form[:language].value} />
        <.input field={@form[:email]} type="email" label="Email" autocomplete="username" required />

        <:actions>
          <.button phx-disable-with="Creating account..." class="w-full">Create an account</.button>
        </:actions>
      </.simple_form>
    </div>
    """
  end

  def mount(_params, _session, %{assigns: %{current_user: %User{}}} = socket) do
    {:ok, redirect(socket, to: ZoonkWeb.UserAuth.signed_in_path(socket))}
  end

  def mount(_params, _session, socket) do
    timezone = get_connect_params(socket)["timezone"]
    changeset = Auth.change_user_email(%User{timezone: timezone})

    socket =
      socket
      |> assign(check_errors: false)
      |> assign_form(changeset)

    {:ok, socket, temporary_assigns: [form: nil]}
  end

  def handle_event("save", %{"user" => user_params}, socket) do
    case Auth.register_user(user_params) do
      {:ok, user} ->
        {:ok, _url_fn} =
          Auth.deliver_signin_instructions(
            user,
            &url(~p"/users/signin/#{&1}")
          )

        {:noreply,
         socket
         |> put_flash(
           :info,
           "An email was sent to #{user.email}, please access it to confirm your account."
         )
         |> push_navigate(to: ~p"/users/signin")}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply,
         socket
         |> assign(check_errors: true)
         |> assign_form(changeset)}
    end
  end

  def handle_event("validate", %{"user" => user_params}, socket) do
    changeset = Auth.change_user_email(%User{}, user_params)
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
