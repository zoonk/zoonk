defmodule ZoonkWeb.Components.ContentReaction do
  @moduledoc """
  A component for displaying content reactions.

  Content reactions are a way for users to send us quick
  feedback on our content.

  It allows users to give us thumbs up or thumbs down feedback.

  ## Usage

  You need to attach `handle_event` and `handle_async` hooks
  to use this component:

      import ZoonkWeb.Components.ContentReaction

      def mount(params, session, socket) do
        socket =
          socket
          |> assign(:reaction, nil)
          |> assign(:content, Phoenix.LiveView.AsyncResult.loading())
          |> start_async(:fetch_content, fn -> assign_content() end)
          |> attach_hook(:fetch_content, :handle_async, &async_hook/3)
          |> attach_hook(:react, :handle_event, &event_hook/3)

        {:ok, socket}
      end
  """
  use Phoenix.Component
  use Gettext, backend: Zoonk.Gettext

  import ZoonkWeb.Components.Icon
  import ZoonkWeb.Components.Text

  alias Phoenix.LiveView.AsyncResult
  alias Zoonk.Catalog
  alias Zoonk.Catalog.ContentReaction

  attr :reaction, ContentReaction, default: nil, doc: "The current content reaction"

  @doc """
  Renders the content reaction component.

  ## Examples

      <.content_reaction reaction={%ContentReaction{}} />
  """
  def content_reaction(assigns) do
    ~H"""
    <div class="mx-auto flex w-full flex-col gap-1 pb-8 text-center">
      <.text tag="h6" variant={:secondary} size={:sm}>
        {gettext("Did you like this content?")}
      </.text>

      <div class="text-zk-muted-foreground flex items-center justify-center gap-4">
        <button phx-click="react" phx-value-reaction="thumbs_up">
          <.icon name={icon_name(:thumbs_up, @reaction)} label={gettext("Thumbs up")} />
        </button>

        <button phx-click="react" phx-value-reaction="thumbs_down">
          <.icon name={icon_name(:thumbs_down, @reaction)} label={gettext("Thumbs down")} />
        </button>
      </div>
    </div>
    """
  end

  def async_hook(:fetch_content, {:ok, content}, socket) do
    reaction = Catalog.get_content_reaction(socket.assigns.scope, content.content_id)

    {:halt,
     socket
     |> assign(:reaction, reaction)
     |> assign(:content, AsyncResult.ok(socket.assigns.content, content))}
  end

  def async_hook(:fetch_content, {:exit, reason}, socket) do
    {:halt, assign(socket, :content, AsyncResult.failed(socket.assigns.content, reason))}
  end

  def event_hook("react", %{"reaction" => reaction}, socket) when is_nil(socket.assigns.reaction) do
    scope = socket.assigns.scope
    content_id = socket.assigns.content.result.content_id

    case Catalog.create_content_reaction(scope, %{content_id: content_id, reaction: reaction}) do
      {:ok, reaction} ->
        {:halt, assign(socket, :reaction, reaction)}

      {:error, reason} ->
        {:halt, assign(socket, :error, reason)}
    end
  end

  def event_hook("react", %{"reaction" => reaction}, socket) do
    scope = socket.assigns.scope

    case Catalog.update_content_reaction(scope, socket.assigns.reaction, %{reaction: reaction}) do
      {:ok, reaction} ->
        {:halt, assign(socket, :reaction, reaction)}

      {:error, :unauthorized} ->
        {:halt, assign(socket, :error, :unauthorized)}
    end
  end

  defp icon_name(:thumbs_up, %ContentReaction{reaction: :thumbs_up}), do: "tabler-thumb-up-filled"
  defp icon_name(:thumbs_down, %ContentReaction{reaction: :thumbs_down}), do: "tabler-thumb-down-filled"
  defp icon_name(:thumbs_up, _reaction), do: "tabler-thumb-up"
  defp icon_name(:thumbs_down, _reaction), do: "tabler-thumb-down"
end
