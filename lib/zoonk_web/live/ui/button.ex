defmodule ZoonkDev.Live.UIButton do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <article class="flex flex-col gap-4">
      <.button variant={:primary}>Primary</.button>
      <.button variant={:destructive}>Destructive</.button>
      <.button variant={:outline}>Outline</.button>

      <.button icon="tabler-check" size={:sm}>Small</.button>
      <.button icon="tabler-check" size={:md}>Medium</.button>
      <.button icon="tabler-check" size={:lg}>Large</.button>

      <.button variant={:primary} disabled>Primary Disabled</.button>
      <.button variant={:destructive} disabled>Destructive Disabled</.button>
      <.button variant={:outline} disabled>Outline Disabled</.button>
    </article>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Button")
    {:ok, socket}
  end
end
