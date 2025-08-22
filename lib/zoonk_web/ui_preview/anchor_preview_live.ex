defmodule ZoonkWeb.UIPreview.AnchorPreviewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.UIPreview.UIPreviewLayout.render active_page={:anchor} page_title={@page_title}>
      <.card>
        <.card_header>
          <.card_title>Link</.card_title>
          <.card_description>
            Styled link component - a wrapper around the <code>link</code>
            component provided by Phoenix.
          </.card_description>
        </.card_header>

        <.card_content align={:bottom}>
          <.a kind={:link}>Link kind</.a>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Button Links</.card_title>
          <.card_description>
            Links can be styled as buttons by passing the <code>kind</code> attribute.
          </.card_description>
        </.card_header>

        <.card_content align={:bottom}>
          <.a kind={:button}>Button kind</.a>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Button Sizes</.card_title>
          <.card_description>Buttons can have multiple sizes.</.card_description>
        </.card_header>

        <.card_content align={:bottom}>
          <.a kind={:button} icon="tabler-ufo" size={:sm}>Small</.a>
          <.a kind={:button} icon="tabler-ufo" size={:md}>Medium</.a>
          <.a kind={:button} icon="tabler-ufo" size={:lg}>Large</.a>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Button Variants</.card_title>
          <.card_description>Buttons can have multiple variants.</.card_description>
        </.card_header>

        <.card_content align={:bottom}>
          <.a kind={:button} variant={:primary}>Primary</.a>
          <.a kind={:button} variant={:destructive}>Destructive</.a>
          <.a kind={:button} variant={:secondary}>Secondary</.a>
          <.a kind={:button} variant={:outline}>Outline</.a>
          <.a kind={:button} variant={:active}>Active</.a>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Button Icons</.card_title>
          <.card_description>You can have an icon in multiple positions.</.card_description>
        </.card_header>

        <.card_content align={:bottom} class="grid grid-cols-3 gap-2">
          <.a kind={:button} icon="tabler-ufo" icon_align={:left} class="w-full">Left</.a>
          <.a kind={:button} icon="tabler-ufo" icon_align={:right} class="w-full">Right</.a>
          <.a kind={:button} icon="tabler-ufo" icon_align={:auto} class="w-full">Auto</.a>
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
          <.a kind={:button} icon_align={:left} icon="tabler-ufo" class="w-full">Full width</.a>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Icon Links</.card_title>
          <.card_description>
            You can also style links as icon buttons. This is useful for
            navigation or actions that don't require a full button.
          </.card_description>
        </.card_header>

        <.card_content align={:bottom}>
          <.a kind={:icon} size={:sm} icon="tabler-x">
            Small icon
          </.a>

          <.a kind={:icon} size={:md} variant={:destructive} icon="tabler-x">
            Medium icon
          </.a>

          <.a kind={:icon} size={:lg} variant={:outline} icon="tabler-x">
            Large icon
          </.a>

          <.a kind={:icon} size={:lg} variant={:secondary} icon="tabler-x">
            Large secondary icon
          </.a>

          <.a kind={:icon} size={:lg} variant={:active} icon="tabler-x">
            Large active icon
          </.a>
        </.card_content>
      </.card>
    </ZoonkWeb.UIPreview.UIPreviewLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Anchor")
    {:ok, socket}
  end
end
