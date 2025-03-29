defmodule ZoonkDev.UIPreview.AvatarPreviewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkDev.UIPreview.UIPreviewLayout.render active_page={:avatar} page_title={@page_title}>
      <.card>
        <.card_header>
          <.card_title>Avatar Sizes</.card_title>
          <.card_description>Avatars can have multiple sizes.</.card_description>
        </.card_header>

        <.card_content align={:center} class="flex items-center justify-center gap-4">
          <.avatar src={avatar_url()} alt="Small avatar" size={:sm} />
          <.avatar src={avatar_url()} alt="Medium avatar" size={:md} />
          <.avatar src={avatar_url()} alt="Large avatar" size={:lg} />
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Placeholder Avatars</.card_title>
          <.card_description>
            When no image is provided, the avatar displays the first letter of the alt text as a placeholder.
          </.card_description>
        </.card_header>

        <.card_content align={:center} class="flex items-center justify-center gap-4">
          <.avatar alt="Small avatar" size={:sm} />
          <.avatar alt="Medium avatar" size={:md} />
          <.avatar alt="Large avatar" size={:lg} />
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Custom Styling</.card_title>
          <.card_description>
            Avatars can be customized with additional classes.
          </.card_description>
        </.card_header>

        <.card_content align={:center} class="flex items-center justify-center gap-4">
          <.avatar src={avatar_url()} alt="Border avatar" class="border-zk-primary border-2" />
          <.avatar alt="John Doe" class="bg-zk-primary text-zk-primary-foreground" />
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Avatar Usage</.card_title>
          <.card_description>
            Avatars are commonly used for user profiles and comments.
          </.card_description>
        </.card_header>

        <.card_content align={:center} class="flex items-center justify-center gap-1">
          <.avatar src={avatar_url()} size={:md} alt="User avatar" />

          <div>
            <.text tag="h4" class="font-medium">John Doe</.text>
            <.text tag="p" size={:sm} variant={:secondary}>Member since 2023</.text>
          </div>
        </.card_content>
      </.card>
    </ZoonkDev.UIPreview.UIPreviewLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Avatar")
    {:ok, socket}
  end

  defp avatar_url, do: ~p"/images/favicon/180.png"
end
