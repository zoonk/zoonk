defmodule ZoonkDev.Live.UIButton do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkDev.Layouts.UIPreview.render active_page={:button} flash={@flash} page_title={@page_title}>
      <.card>
        <.card_header>
          <.card_title>Button Variants</.card_title>
          <.card_description>Buttons can have multiple variants.</.card_description>
        </.card_header>

        <.card_content align={:bottom}>
          <.button variant={:primary}>Primary</.button>
          <.button variant={:destructive}>Destructive</.button>
          <.button variant={:outline}>Outline</.button>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Button Sizes</.card_title>
          <.card_description>Buttons can have multiple sizes.</.card_description>
        </.card_header>

        <.card_content align={:bottom}>
          <.button size={:sm}>Small</.button>
          <.button size={:md}>Medium</.button>
          <.button size={:lg}>Large</.button>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Button Icons</.card_title>
          <.card_description>You can have an icon in multiple alignments.</.card_description>
        </.card_header>

        <.card_content align={:bottom} class="grid grid-cols-3 gap-4">
          <.button icon="tabler-ufo" icon_align={:left} class="w-full">Left</.button>
          <.button icon="tabler-ufo" icon_align={:right} class="w-full">Right</.button>
          <.button icon="tabler-ufo" icon_align={:auto} class="w-full">Auto</.button>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Disabled Buttons</.card_title>
          <.card_description>
            Buttons can be disabled to prevent user interaction.
          </.card_description>
        </.card_header>

        <.card_content align={:bottom}>
          <.button variant={:primary} disabled>Primary</.button>
          <.button variant={:destructive} disabled>Destructive</.button>
          <.button variant={:outline} disabled>Outline</.button>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Custom Buttons</.card_title>
          <.card_description>
            Add custom classes to buttons. For example, <code>w-full</code>
            makes it use the entire width.
          </.card_description>
        </.card_header>

        <.card_content align={:bottom}>
          <.button icon="tabler-ufo" class="w-full">Full width</.button>
        </.card_content>
      </.card>
    </ZoonkDev.Layouts.UIPreview.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Button")
    {:ok, socket}
  end
end
