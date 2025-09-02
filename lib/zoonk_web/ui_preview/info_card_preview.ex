defmodule ZoonkWeb.UIPreview.InfoPreviewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.UIPreview.UIPreviewLayout.render active_page={:info} page_title={@page_title}>
      <.card>
        <.card_header>
          <.card_title>Info</.card_title>
          <.card_description>
            Useful for showcasing use cases, features, or benefits.
          </.card_description>
        </.card_header>

        <.card_content>
          <.info_card>
            <.info_header
              icon="tabler-headphones"
              title="Marketing"
              subtitle="Engaging customer learning"
            />

            <.info_description>
              This is a description of the info card. It provides additional context and details about the card's content.
            </.info_description>
          </.info_card>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Info Card with a list</.card_title>
          <.card_description>Info cards can also contain lists of information.</.card_description>
        </.card_header>

        <.card_content>
          <.info_card>
            <.info_header
              icon="tabler-headphones"
              title="Marketing"
              subtitle="Engaging customer learning"
            />

            <.info_description>
              This is a description of the info card. It provides additional context and details about the card's content.
            </.info_description>

            <.info_list>
              <.info_list_item icon="tabler-check">
                Description of feature 1
              </.info_list_item>

              <.info_list_item icon="tabler-book">
                Description of feature 2
              </.info_list_item>

              <.info_list_item icon="tabler-users">
                Description of feature 3
              </.info_list_item>
            </.info_list>
          </.info_card>
        </.card_content>
      </.card>
    </ZoonkWeb.UIPreview.UIPreviewLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    {:ok, assign(socket, page_title: "Info Card")}
  end
end
