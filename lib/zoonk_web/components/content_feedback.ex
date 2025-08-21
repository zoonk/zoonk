defmodule ZoonkWeb.Components.ContentFeedback do
  @moduledoc """
  Allows users to react or send feedback on content.

  ## Usage

      <.live_component
        module={ZoonkWeb.Components.ContentFeedback}
        id="content-feedback"
        scope={@scope}
        content_id={@content.id}
      />
  """
  use ZoonkWeb, :live_component

  alias Zoonk.Catalog
  alias Zoonk.Catalog.ContentReaction

  attr :id, :string, required: true, doc: "Unique identifier for the component"
  attr :scope, :any, required: true, doc: "The scope from the user providing feedback"
  attr :content_id, :integer, required: true, doc: "The ID of the content being reacted to"

  @impl Phoenix.LiveComponent
  def render(assigns) do
    ~H"""
    <footer id={@id} class="mx-auto flex w-full flex-col items-center gap-4 pb-8 text-center">
      <div class="mx-auto flex w-full flex-col gap-1">
        <.text tag="h6" variant={:secondary} size={:sm}>
          {gettext("Did you like this content?")}
        </.text>

        <div class="text-zk-muted-foreground flex items-center justify-center">
          <button
            phx-click="react"
            phx-value-reaction="thumbs_up"
            class={button_class()}
            phx-target={@myself}
          >
            <span class="sr-only">{gettext("Thumbs up")}</span>
            <.icon name={icon_name(:thumbs_up, @content_reaction)} />
          </button>

          <button
            phx-click="react"
            phx-value-reaction="thumbs_down"
            class={button_class()}
            phx-target={@myself}
          >
            <span class="sr-only">{gettext("Thumbs down")}</span>
            <.icon name={icon_name(:thumbs_down, @content_reaction)} />
          </button>
        </div>
      </div>

      <.button
        id="feedback-dialog-trigger"
        icon="tabler-message-circle"
        variant={:outline}
        data-dialog-id="feedback-dialog"
        phx-hook="DialogTrigger"
        aria-haspopup="true"
        aria-controls="feedback-dialog"
        class="w-max"
      >
        {dgettext("settings", "Send Feedback")}
      </.button>

      <.dialog id="feedback-dialog" class="p-4">
        <.live_component
          id="feedback-form-live"
          module={ZoonkWeb.Components.FeedbackForm}
          scope={@scope}
          show_submit?
        />
      </.dialog>
    </footer>
    """
  end

  @impl Phoenix.LiveComponent
  def update(assigns, socket) do
    content_reaction = Catalog.get_content_reaction(assigns.scope, assigns.content_id)

    {:ok,
     socket
     |> assign(assigns)
     |> assign(:content_reaction, content_reaction)}
  end

  @impl Phoenix.LiveComponent
  def handle_event("react", %{"reaction" => reaction}, socket) when is_nil(socket.assigns.content_reaction) do
    %{scope: scope, content_id: content_id} = socket.assigns

    case Catalog.create_content_reaction(scope, %{content_id: content_id, reaction: reaction}) do
      {:ok, content_reaction} ->
        {:noreply, assign(socket, :content_reaction, content_reaction)}

      {:error, _error} ->
        {:noreply, socket}
    end
  end

  def handle_event("react", %{"reaction" => reaction}, socket) do
    scope = socket.assigns.scope

    case Catalog.update_content_reaction(scope, socket.assigns.content_reaction, %{reaction: reaction}) do
      {:ok, content_reaction} ->
        {:noreply, assign(socket, :content_reaction, content_reaction)}

      {:error, _error} ->
        {:noreply, socket}
    end
  end

  defp icon_name(:thumbs_up, %ContentReaction{reaction: :thumbs_up}), do: "tabler-thumb-up-filled"
  defp icon_name(:thumbs_down, %ContentReaction{reaction: :thumbs_down}), do: "tabler-thumb-down-filled"
  defp icon_name(:thumbs_up, _reaction), do: "tabler-thumb-up"
  defp icon_name(:thumbs_down, _reaction), do: "tabler-thumb-down"

  defp button_class, do: "flex flex-col items-center justify-center rounded-full p-2 bg-transparent hover:bg-zk-secondary"
end
