defmodule ZoonkDev.UIPreview.ButtonPreviewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkDev.UIPreview.UIPreviewLayout.render active_page={:button} page_title={@page_title}>
      <.card>
        <.card_header>
          <.card_title>Button Variants</.card_title>
          <.card_description>Buttons can have multiple variants.</.card_description>
        </.card_header>

        <.card_content align={:bottom}>
          <.button variant={:primary}>Primary</.button>
          <.button variant={:destructive}>Destructive</.button>
          <.button variant={:secondary}>Secondary</.button>
          <.button variant={:outline}>Outline</.button>
          <.button variant={:black}>Black</.button>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Button Sizes</.card_title>
          <.card_description>Buttons can have multiple sizes.</.card_description>
        </.card_header>

        <.card_content align={:bottom}>
          <.button icon="tabler-ufo" size={:sm}>Small</.button>
          <.button icon="tabler-ufo" size={:md}>Medium</.button>
          <.button icon="tabler-ufo" size={:lg}>Large</.button>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Button With Icons</.card_title>
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
          <.button variant={:secondary} disabled>Secondary</.button>
          <.button variant={:outline} disabled>Outline</.button>
          <.button variant={:black} disabled>Black</.button>
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

      <.card>
        <.card_header>
          <.card_title>Icon Buttons</.card_title>
          <.card_description>
            You can also style buttons as icons. This is useful for
            navigation or actions that don't require a full button.
          </.card_description>
        </.card_header>

        <.card_content align={:bottom}>
          <.button kind={:icon} size={:sm} icon="tabler-x">
            Small icon
          </.button>

          <.button kind={:icon} size={:md} variant={:destructive} icon="tabler-x">
            Medium icon
          </.button>

          <.button kind={:icon} size={:lg} variant={:outline} icon="tabler-x">
            Large icon
          </.button>

          <.button kind={:icon} size={:lg} variant={:secondary} icon="tabler-x">
            Large secondary icon
          </.button>

          <.button kind={:icon} size={:lg} variant={:black} icon="tabler-x">
            Large black icon
          </.button>
        </.card_content>
      </.card>
    </ZoonkDev.UIPreview.UIPreviewLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Button")
    {:ok, socket}
  end
end
