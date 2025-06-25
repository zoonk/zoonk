defmodule ZoonkWeb.AuthConfirmCodeLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.AuthComponents

  alias Zoonk.Accounts.User
  alias Zoonk.Scope
  alias ZoonkWeb.UserAuth

  def render(assigns) do
    ~H"""
    <.main_container action={:confirm} flash={@flash}>
      <.text tag="h2" variant={:secondary}>
        {dgettext("auth", "We sent a code to your email address. Please enter it below to proceed.")}
      </.text>

      <.form
        :let={f}
        for={@form}
        id="otp_form"
        action={~p"/confirm?_action=#{@live_action}"}
        aria-label={dgettext("auth", "Enter your code")}
        class="mt-4 flex w-full flex-col gap-4"
      >
        <.input type="hidden" field={f[:email]} />

        <.input
          field={f[:code]}
          label={dgettext("auth", "One-time code")}
          hide_label
          placeholder={dgettext("auth", "Enter your code")}
          autocomplete="one-time-code"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="6"
          required
          class="w-full"
        />

        <.button type="submit" class="w-full" size={:md} icon_align={:left} icon="tabler-check">
          {dgettext("auth", "Verify")}
        </.button>
      </.form>

      <.a navigate={get_back_link(@live_action)} class="mt-4 text-sm">
        {gettext("Back")}
      </.a>
    </.main_container>
    """
  end

  def mount(_params, _session, %{assigns: %{scope: %Scope{user: %User{}}} = assigns} = socket)
      when assigns.live_action == :signup do
    {:ok, redirect(socket, to: UserAuth.signed_in_path(socket))}
  end

  def mount(params, _session, socket) do
    email = get_user_email(socket.assigns, params)
    form = to_form(%{"code" => "", "email" => email}, as: :user)

    socket =
      socket
      |> assign(form: form)
      |> assign(page_title: dgettext("page_title", "Confirmation code"))

    {:ok, socket}
  end

  defp get_user_email(assigns, params) when is_nil(assigns.scope.user), do: params["email"]
  defp get_user_email(assigns, _params), do: assigns.scope.user.email

  defp get_back_link(:email), do: ~p"/email"
  defp get_back_link(:login), do: ~p"/login"
  defp get_back_link(:signup), do: ~p"/signup"
end
