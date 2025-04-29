defmodule ZoonkWeb.User.UserConfirmCodeLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.User.UserComponents

  alias Zoonk.Accounts.User
  alias Zoonk.Scope
  alias ZoonkWeb.UserAuth

  def render(assigns) do
    ~H"""
    <.main_container action={:confirm} flash={@flash}>
      <.text tag="h2" variant={:secondary}>
        {dgettext("users", "We sent a code to your email address. Please enter it below to proceed.")}
      </.text>

      <.form
        :let={f}
        for={@form}
        id="otp_form"
        action={~p"/confirm?_action=#{@live_action}"}
        aria-label={dgettext("users", "Enter your code")}
        class="mt-4 flex w-full flex-col gap-4"
      >
        <.input
          field={f[:code]}
          label={dgettext("users", "One-time code")}
          hide_label
          placeholder={dgettext("users", "Enter your code")}
          autocomplete="one-time-code"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="6"
          required
          class="w-full"
        />

        <.button type="submit" class="w-full" size={:md} icon_align={:left} icon="tabler-check">
          {dgettext("users", "Verify")}
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

  def mount(_params, _session, socket) do
    form = to_form(%{"code" => ""}, as: :user)

    socket =
      socket
      |> assign(form: form)
      |> assign(page_title: dgettext("users", "Confirmation code"))

    {:ok, socket}
  end

  defp get_back_link(:email), do: ~p"/settings"
  defp get_back_link(:login), do: ~p"/login"
  defp get_back_link(:signup), do: ~p"/signup"
end
