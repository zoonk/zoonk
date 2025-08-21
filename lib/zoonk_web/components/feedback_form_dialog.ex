defmodule ZoonkWeb.Components.FeedbackFormDialog do
  @moduledoc """
  Renders a feedback button that triggers a dialog.

  This is a convenient way to collect user feedback
  without leaving the current page.
  """
  use ZoonkWeb, :live_component

  attr :id, :string, required: true, doc: "Unique identifier for the component"
  attr :user, :any, required: true, doc: "The user providing feedback"

  @impl Phoenix.LiveComponent
  def render(assigns) do
    ~H"""
    <div id={@id}>
      <.button
        id="feedback-dialog-trigger"
        icon="tabler-message-circle"
        variant={:outline}
        data-dialog-id="feedback-dialog"
        phx-hook="DialogTrigger"
        aria-haspopup="true"
        aria-controls="feedback-dialog"
      >
        {dgettext("settings", "Send Feedback")}
      </.button>

      <.dialog id="feedback-dialog" class="p-4">
        <.live_component
          id="feedback-form-live"
          module={ZoonkWeb.Components.FeedbackForm}
          user={@user}
        />
      </.dialog>
    </div>
    """
  end
end
