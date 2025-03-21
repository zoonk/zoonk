defmodule ZoonkDev.Live.UIAvatar do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <article class="flex flex-col gap-4">
      <.avatar src={avatar_url()} alt="Small avatar" size={:sm} />
      <.avatar src={avatar_url()} alt="Medium avatar" size={:md} />
      <.avatar src={avatar_url()} alt="Large avatar" size={:lg} />

      <.avatar alt="Small avatar" size={:sm} />
      <.avatar alt="Medium avatar" size={:md} />
      <.avatar alt="Large avatar" size={:lg} />
    </article>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Avatar")
    {:ok, socket}
  end

  defp avatar_url, do: ~p"/images/favicon/180.png"
end
