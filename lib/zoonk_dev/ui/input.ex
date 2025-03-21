defmodule ZoonkDev.Live.UIInput do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <article class="flex flex-col gap-4">
      <.input name="email" label="Email address" placeholder="youremail@zoonk.com" value="" />

      <.input
        type="textarea"
        name="post"
        label="Email address"
        placeholder="Type some text here."
        value=""
      />

      <.input
        name="list"
        type="select"
        label="Select an item"
        options={["Item 1", "Item 2", "Item 3"]}
        prompt="Select an item"
        value=""
        required
      />

      <.input type="checkbox" name="accept" label="Accept terms and conditions" value="" />
    </article>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Input")
    {:ok, socket}
  end
end
