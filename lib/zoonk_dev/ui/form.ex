defmodule ZoonkDev.Live.UIForm do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <article class="flex flex-col gap-4">
      <.form_container for={@email_form} id="email_form">
        <:title>Change Email</:title>

        <:subtitle>
          This is the email address that will be used to sign in. This is not visible to other users.
        </:subtitle>

        <.input
          id="user-email"
          field={@email_form[:email]}
          label="Email address"
          type="email"
          autocomplete="username"
          required
          hide_label
        />

        <:requirements>You'll need to confirm your email address.</:requirements>
      </.form_container>
    </article>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket =
      socket
      |> assign(page_title: "Form")
      |> assign(:email_form, to_form(%{email: ""}))

    {:ok, socket}
  end
end
