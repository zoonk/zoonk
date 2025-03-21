defmodule ZoonkDev.Live.UIAnchor do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <article class="flex flex-col gap-4">
      <.a kind={:link}>Link kind</.a>
      <.a kind={:button}>Button kind</.a>

      <.a kind={:icon} icon="tabler-x">
        <span class="sr-only">Icon kind</span>
      </.a>

      <.a kind={:button} size={:sm}>Small</.a>
      <.a kind={:button} size={:md}>Medium</.a>
      <.a kind={:button} size={:lg}>Large</.a>

      <.a kind={:button} class="w-full" icon="tabler-check">Full width</.a>

      <.a kind={:button} variant={:primary}>Primary</.a>
      <.a kind={:button} variant={:outline}>Outline</.a>
      <.a kind={:button} variant={:destructive}>Destructive</.a>
    </article>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Anchor")
    {:ok, socket}
  end
end
