defmodule ZoonkWeb.Components.FeedbackForm do
  @moduledoc """
  A reusable feedback form component for collecting user feedback.

  ## Usage

      <.live_component
        module={ZoonkWeb.Components.FeedbackForm}
        id="feedback-form-live"
        scope={@scope}
      />

  """
  use ZoonkWeb, :live_component
  use Gettext, backend: Zoonk.Gettext

  import ZoonkWeb.Components.Button
  import ZoonkWeb.Components.Form
  import ZoonkWeb.Components.Input
  import ZoonkWeb.Components.Text

  alias Phoenix.LiveView.JS
  alias Zoonk.Support

  attr :id, :string, required: true, doc: "Unique identifier for the component"
  attr :scope, :any, required: true, doc: "The scope from the user providing feedback"
  attr :show_submit?, :boolean, default: false, doc: "Show submit button and success message below the form"

  @impl Phoenix.LiveComponent
  def render(assigns) do
    ~H"""
    <section id={@id}>
      <.form_container
        for={@feedback_form}
        phx-submit="submit_feedback"
        phx-change="validate_feedback"
        phx-target={@myself}
      >
        <:title>{dgettext("settings", "Send feedback")}</:title>

        <:subtitle>
          {dgettext(
            "settings",
            "Help us improve by sharing your thoughts, suggestions, or reporting issues. You can also reach out to us at %{email}",
            email: Support.support_email()
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

        <div :if={@show_submit?} class="flex items-center gap-2">
          <.button type="submit" size={:sm}>{dgettext("settings", "Send feedback")}</.button>

          <.button
            type="button"
            size={:sm}
            variant={:outline}
            phx-click={JS.dispatch("closeDialog")}
          >
            {dgettext("settings", "Cancel")}
          </.button>

          <.text :if={@display_success?} tag="p" class="text-zk-success-text">
            {dgettext("settings", "Done!")}
          </.text>
        </div>
      </.form_container>
    </section>
    """
  end

  @impl Phoenix.LiveComponent
  def mount(socket) do
    {:ok, assign(socket, display_success?: false)}
  end

  @impl Phoenix.LiveComponent
  def update(assigns, socket) do
    user_email = if assigns.scope.user, do: assigns.scope.user.email, else: ""
    feedback_changeset = Support.change_feedback(%{email: user_email})

    {:ok,
     socket
     |> assign(assigns)
     |> assign(feedback_form: to_form(feedback_changeset, as: :feedback))}
  end

  @impl Phoenix.LiveComponent
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

  def handle_event("submit_feedback", %{"feedback" => feedback_params}, socket) do
    case Support.send_feedback(feedback_params["email"], feedback_params["message"]) do
      {:ok, :sent} ->
        send(self(), {__MODULE__, :display_success?, true})

        {:noreply, assign(socket, :display_success?, true)}

      {:error, changeset} ->
        {:noreply, assign(socket, :feedback_form, to_form(changeset, as: :feedback, action: :insert))}
    end
  end
end
