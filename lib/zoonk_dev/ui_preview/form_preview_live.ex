defmodule ZoonkDev.UIPreview.FormPreviewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkDev.UIPreview.UIPreviewLayout.render
      active_page={:form}
      flash={@flash}
      page_title={@page_title}
    >
      <.card>
        <.card_header>
          <.card_title>Basic Form</.card_title>
          <.card_description>
            A basic form container with title, subtitle, and a save button.
          </.card_description>
        </.card_header>

        <.card_content>
          <.form_container for={@basic_form} id="basic_form">
            <:title>Basic Form</:title>
            <:subtitle>Enter the required information below.</:subtitle>

            <.input field={@basic_form[:name]} label="Name" placeholder="Enter your name" required />

            <:requirements>All fields are required.</:requirements>
          </.form_container>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Multiple Fields Form</.card_title>
          <.card_description>
            A form with multiple input fields of different types.
          </.card_description>
        </.card_header>

        <.card_content>
          <.form_container for={@profile_form} id="profile_form">
            <:title>Profile Information</:title>
            <:subtitle>Enter your profile details below.</:subtitle>

            <div class="flex flex-col gap-4">
              <.input
                field={@profile_form[:full_name]}
                label="Full Name"
                placeholder="Your full name"
                required
                class="w-full"
              />

              <.input
                field={@profile_form[:bio]}
                label="Biography"
                placeholder="Tell us about yourself"
                type="textarea"
                class="w-full"
              />

              <.input field={@profile_form[:birthday]} label="Birthday" type="date" />
            </div>

            <:requirements>Fill out your profile to help others know you better.</:requirements>
          </.form_container>
        </.card_content>
      </.card>
    </ZoonkDev.UIPreview.UIPreviewLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket =
      socket
      |> assign(page_title: "Form")
      |> assign(:basic_form, to_form(%{name: ""}))
      |> assign(:profile_form, to_form(%{full_name: "", bio: "", birthday: nil}))

    {:ok, socket}
  end
end
