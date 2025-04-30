defmodule ZoonkDev.UIPreview.DropdownPreviewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkDev.UIPreview.UIPreviewLayout.render active_page={:dropdown} page_title={@page_title}>
      <.card>
        <.card_header>
          <.card_title>Dropdown</.card_title>
          <.card_description>Trigger a dropdown menu.</.card_description>
        </.card_header>

        <.card_content align={:center} class="flex items-center justify-center gap-4">
          <.dropdown>
            <.avatar alt="Small avatar" size={:sm} />

            <.dropdown_content>
              <.dropdown_item icon="tabler-settings">Settings</.dropdown_item>
              <.dropdown_item icon="tabler-user">Profile</.dropdown_item>
              <.dropdown_item variant={:destructive} icon="tabler-logout">Logout</.dropdown_item>
            </.dropdown_content>
          </.dropdown>
        </.card_content>
      </.card>
    </ZoonkDev.UIPreview.UIPreviewLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Dropdown")
    {:ok, socket}
  end
end
