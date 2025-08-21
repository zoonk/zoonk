defmodule ZoonkWeb.Components.FeedbackForm do
  @moduledoc """
  A reusable feedback form component for collecting user feedback.

  ## Usage

      import ZoonkWeb.Components.FeedbackForm

      def mount(params, session, socket) do
        user_email = if socket.assigns.scope.user, do: socket.assigns.scope.user.email, else: ""
        feedback_changeset = Support.change_feedback(%{email: user_email})

        socket =
          socket
          |> assign(:feedback_form, to_form(feedback_changeset, as: :feedback))
          |> assign(:display_success?, false)
          |> attach_hook(:feedback_event, :handle_event, &event_hook/3)

        {:ok, socket}
      end

  """
  use Phoenix.Component
  use Gettext, backend: Zoonk.Gettext

  import ZoonkWeb.Components.Button
  import ZoonkWeb.Components.Form
  import ZoonkWeb.Components.Input
  import ZoonkWeb.Components.Text

  alias Zoonk.Support

  attr :feedback_form, :any, required: true, doc: "The feedback form struct"
  attr :display_success?, :boolean, default: false, doc: "Show success message after submit"
  attr :support_email, :string, default: Support.support_email(), doc: "Support email address"
  attr :show_submit?, :boolean, default: true, doc: "Show submit button and success message below the form"

  @doc """
  Renders the feedback form component.
  """
  def feedback_form(assigns) do
    ~H"""
    <.form_container
      for={@feedback_form}
      id="feedback_form"
      phx-submit="submit_feedback"
      phx-change="validate_feedback"
    >
      <:title>{dgettext("settings", "Send feedback")}</:title>

      <:subtitle>
        {dgettext(
          "settings",
          "Help us improve by sharing your thoughts, suggestions, or reporting issues. You can also reach out to us at %{email}",
          email: @support_email
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

      <div :if={@show_submit?} class="mt-4 flex items-center gap-2">
        <.button type="submit" size={:sm}>{dgettext("settings", "Send feedback")}</.button>

        <.text :if={@display_success?} tag="p" class="text-green-600">
          {dgettext("settings", "Done!")}
        </.text>
      </div>
    </.form_container>
    """
  end

  @doc """
  Handles feedback form events (validate and submit).
  Attach this as a hook in your LiveView.
  """
  def event_hook("validate_feedback", %{"feedback" => feedback_params}, socket) do
    feedback_form =
      feedback_params
      |> Support.change_feedback()
      |> Map.put(:action, :validate)
      |> to_form(as: :feedback)

    socket =
      socket
      |> assign(:feedback_form, feedback_form)
      |> assign(:display_success?, false)

    {:halt, socket}
  end

  def event_hook("submit_feedback", %{"feedback" => feedback_params}, socket) do
    case Support.send_feedback(feedback_params["email"], feedback_params["message"]) do
      {:ok, :sent} ->
        user_email = if socket.assigns.scope.user, do: socket.assigns.scope.user.email, else: ""
        feedback_changeset = Support.change_feedback(%{email: user_email})

        socket =
          socket
          |> assign(:feedback_form, to_form(feedback_changeset, as: :feedback))
          |> assign(:display_success?, true)

        {:halt, socket}

      {:error, changeset} ->
        {:halt, assign(socket, :feedback_form, to_form(changeset, as: :feedback, action: :insert))}
    end
  end
end
