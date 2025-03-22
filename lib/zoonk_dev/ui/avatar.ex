defmodule ZoonkDev.Live.UIAvatar do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <article class="zk-grid">
      <.card>
        <.card_header>
          <.card_title>Avatar Sizes</.card_title>
          <.card_description>Avatars can have multiple sizes.</.card_description>
        </.card_header>

        <.card_content>
          <div class="flex items-center gap-4">
            <.avatar src={avatar_url()} alt="Small avatar" size={:sm} />
            <.avatar src={avatar_url()} alt="Medium avatar" size={:md} />
            <.avatar src={avatar_url()} alt="Large avatar" size={:lg} />
          </div>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Placeholder Avatars</.card_title>
          <.card_description>
            When no image is provided, the avatar displays the first letter of the alt text as a placeholder.
          </.card_description>
        </.card_header>

        <.card_content>
          <div class="flex items-center gap-4">
            <.avatar alt="Small avatar" size={:sm} />
            <.avatar alt="Medium avatar" size={:md} />
            <.avatar alt="Large avatar" size={:lg} />
          </div>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Custom Styling</.card_title>
          <.card_description>
            Avatars can be customized with additional classes.
          </.card_description>
        </.card_header>

        <.card_content>
          <div class="flex items-center gap-4">
            <.avatar src={avatar_url()} alt="Border avatar" class="border-zk-primary border-2" />
            <.avatar alt="John Doe" class="bg-zk-primary text-zk-primary-foreground" />
          </div>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Avatar Usage</.card_title>
          <.card_description>
            Avatars are commonly used for user profiles and comments.
          </.card_description>
        </.card_header>

        <.card_content>
          <div class="flex items-center gap-4">
            <.avatar src={avatar_url()} alt="User avatar" />
            <div>
              <h4 class="font-medium">John Doe</h4>
              <p class="text-zk-muted-foreground text-sm">Member since 2023</p>
            </div>
          </div>
        </.card_content>
      </.card>
    </article>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Avatar")
    {:ok, socket}
  end

  defp avatar_url, do: ~p"/images/favicon/180.png"
end
