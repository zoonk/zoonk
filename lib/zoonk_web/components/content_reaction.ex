defmodule ZoonkWeb.Components.ContentReaction do
  @moduledoc """
  A component for displaying content reactions.

  Content reactions are a way for users to send us quick
  feedback on our content.

  It allows users to give us thumbs up or thumbs down feedback.
  """
  use Phoenix.Component

  alias Phoenix.LiveView.AsyncResult
  alias Zoonk.Catalog

  def content_reaction(assigns) do
    ~H"""
    <div>
      <button phx-click="react" phx-value="thumbs_up">👍</button>
      <button phx-click="react" phx-value="thumbs_down">👎</button>
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
    content_id = socket.assigns.content.content_id

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
end
