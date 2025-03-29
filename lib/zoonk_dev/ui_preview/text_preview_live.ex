defmodule ZoonkDev.UIPreview.TextPreviewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkDev.UIPreview.UIPreviewLayout.render active_page={:text} page_title={@page_title}>
      <.card>
        <.card_header>
          <.card_title>Text Sizes</.card_title>
          <.card_description>Text can have multiple sizes.</.card_description>
        </.card_header>

        <.card_content class="flex flex-col gap-4">
          <.text tag="h1" size={:xxl}>XXL Text</.text>
          <.text tag="h2" size={:xl}>XL Text</.text>
          <.text tag="h3" size={:lg}>LG Text</.text>
          <.text tag="p" size={:md}>MD Text</.text>
          <.text tag="span" size={:sm}>SM Text</.text>
          <.text tag="span" size={:xs}>XS Text</.text>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Text Variants</.card_title>
          <.card_description>Text can have different color variants.</.card_description>
        </.card_header>

        <.card_content class="flex flex-col gap-4">
          <.text tag="p" size={:md} variant={:primary}>Primary Text - Main content text</.text>
          <.text tag="p" size={:md} variant={:secondary}>
            Secondary Text - Supporting content text
          </.text>
          <.text tag="p" size={:md} variant={:custom} class="text-zk-primary">
            Custom Text - With custom color
          </.text>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>HTML Tags</.card_title>
          <.card_description>Text can use different HTML tags for semantic markup.</.card_description>
        </.card_header>

        <.card_content class="flex flex-col gap-4">
          <.text tag="h1">Heading 1</.text>
          <.text tag="h2">Heading 2</.text>
          <.text tag="p">Paragraph</.text>
          <.text tag="span">Span</.text>
          <.text tag="label" for="example">Label</.text>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Custom Styling</.card_title>
          <.card_description>Text can be customized with additional classes.</.card_description>
        </.card_header>

        <.card_content class="flex flex-col gap-4">
          <.text tag="p" class="italic">Italic text</.text>
          <.text tag="p" class="font-bold">Bold text</.text>
          <.text tag="p" class="underline">Underlined text</.text>
          <.text
            tag="p"
            variant={:custom}
            class="bg-zk-primary text-zk-primary-foreground rounded px-4 py-2"
          >
            Custom background and padding
          </.text>
        </.card_content>
      </.card>
    </ZoonkDev.UIPreview.UIPreviewLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Text")
    {:ok, socket}
  end
end
