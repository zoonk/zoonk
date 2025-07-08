defmodule ZoonkWeb.FeedbackLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Support

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render flash={@flash} scope={@scope}>
      <.form_container
        for={@feedback_form}
        id="feedback_form"
        phx-submit="submit"
        phx-change="validate_feedback"
        display_success={@display_success?}
        save_label={dgettext("settings", "Send feedback")}
      >
        <:title>{dgettext("settings", "Send feedback")}</:title>

        <:subtitle>
          {dgettext(
            "settings",
            "Help us improve by sharing your thoughts, suggestions, or reporting issues."
          )}
        </:subtitle>

        <.input
          id="feedback-email"
          field={@feedback_form[:email]}
          label={dgettext("settings", "Email address")}
          type="email"
          autocomplete="email"
          required
        />

        <.input
          id="feedback-message"
          field={@feedback_form[:message]}
          label={dgettext("settings", "Message")}
          type="textarea"
          placeholder={
            dgettext(
              "settings",
              "Tell us what you think or report any issues you've encountered..."
            )
          }
          rows={4}
          required
          class="w-full"
        />

        <:requirements>
          {dgettext(
            "settings",
            "You can also reach out to us at %{email}",
            email: Support.support_email()
          )}
        </:requirements>
      </.form_container>
    </ZoonkWeb.AppLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    user_email = if socket.assigns.scope.user, do: socket.assigns.scope.user.email, else: ""
    feedback_changeset = Support.change_feedback(%{email: user_email})

    socket =
      socket
      |> assign(:feedback_form, to_form(feedback_changeset, as: :feedback))
      |> assign(:display_success?, false)
      |> assign(:page_title, dgettext("page_title", "Send feedback"))

    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def handle_event("validate_feedback", %{"feedback" => feedback_params}, socket) do
    feedback_form =
      feedback_params
      |> Support.change_feedback()
      |> Map.put(:action, :validate)
      |> to_form(as: :feedback)

    socket =
      socket
      |> assign(:feedback_form, feedback_form)
      |> assign(:display_success?, false)

    {:noreply, socket}
  end

  def handle_event("submit", %{"feedback" => feedback_params}, socket) do
    case Support.send_feedback(feedback_params["email"], feedback_params["message"]) do
      {:ok, :sent} ->
        # Clear the form and show success message
        user_email = if socket.assigns.scope.user, do: socket.assigns.scope.user.email, else: ""
        feedback_changeset = Support.change_feedback(%{email: user_email})

        socket =
          socket
          |> assign(:feedback_form, to_form(feedback_changeset, as: :feedback))
          |> assign(:display_success?, true)

        {:noreply, socket}

      {:error, changeset} ->
        {:noreply, assign(socket, :feedback_form, to_form(changeset, as: :feedback, action: :insert))}
    end
  end
end
