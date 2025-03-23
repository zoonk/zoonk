defmodule ZoonkDev.Live.UICard do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkDev.Layouts.UIPreview.render active_page={:card} flash={@flash} page_title={@page_title}>
      <.card>
        <.card_header>
          <.card_title>Basic Card</.card_title>
          <.card_description>
            A basic card component with header and content sections.
          </.card_description>
        </.card_header>

        <.card_content>
          <.text>
            Cards are used to group related content. They can contain various elements
            such as text, images, and interactive components.
          </.text>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Card with Icon</.card_title>
          <.card_description>
            Cards can include an icon in the header for visual identification.
          </.card_description>
        </.card_header>

        <.card_content>
          <.card>
            <.card_header icon="tabler-settings">
              <.card_title>Settings</.card_title>
              <.card_description>Manage your account settings and preferences.</.card_description>
            </.card_header>

            <.card_content>
              <.text>This card displays a settings icon in the header.</.text>
            </.card_content>
          </.card>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Content-Only Card</.card_title>
          <.card_description>
            Cards can be used without headers for simpler content presentation.
          </.card_description>
        </.card_header>

        <.card_content>
          <.card>
            <.card_content>
              <.text>
                This is a card without a header section. It's useful for simple content
                that doesn't need categorization or a title.
              </.text>
            </.card_content>
          </.card>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Card with Interactive Content</.card_title>
          <.card_description>
            Cards can contain interactive elements like buttons or forms.
          </.card_description>
        </.card_header>

        <.card_content>
          <.card>
            <.card_header icon="tabler-user">
              <.card_title>User Profile</.card_title>
              <.card_description>View and edit your profile information.</.card_description>
            </.card_header>

            <.card_content class="flex flex-col gap-4">
              <.text>Update your profile settings below.</.text>

              <div class="flex gap-2">
                <.button variant={:outline}>Cancel</.button>
                <.button variant={:primary}>Save Changes</.button>
              </div>
            </.card_content>
          </.card>
        </.card_content>
      </.card>
    </ZoonkDev.Layouts.UIPreview.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, page_title: "Card")
    {:ok, socket}
  end
end
