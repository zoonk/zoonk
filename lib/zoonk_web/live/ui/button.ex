defmodule ZoonkDev.Live.UIButton do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <article>
      <.button variant={:primary}>Save</.button>
      <.button variant={:outline}>Save</.button>

      <.button icon="tabler-check" size={:sm}>Save</.button>
      <.button icon="tabler-check" size={:md}>Save</.button>
      <.button icon="tabler-check" size={:lg}>Save</.button>
    </article>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Button")
    {:ok, socket}
  end
end
