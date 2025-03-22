defmodule ZoonkDev.Live.UIInput do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <article class="zk-grid">
      <.card>
        <.card_header>
          <.card_title>Text Input</.card_title>
          <.card_description>Basic text input field with label.</.card_description>
        </.card_header>

        <.card_content align={:center} class="">
          <.input
            name="email"
            label="Email address"
            placeholder="youremail@gmail.com"
            value=""
            class="w-full"
          />
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Disabled Input</.card_title>
          <.card_description>Input fields can be disabled to prevent interaction.</.card_description>
        </.card_header>

        <.card_content align={:center}>
          <.input
            name="email"
            label="Email address"
            placeholder="youremail@gmail.com"
            value=""
            disabled
            class="w-full"
          />
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Textarea Input</.card_title>
          <.card_description>Multi-line text input for longer content.</.card_description>
        </.card_header>

        <.card_content align={:center}>
          <.input
            type="textarea"
            name="post"
            label="Your message:"
            placeholder="Type some text here."
            value=""
            class="w-full"
          />
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Select Input</.card_title>
          <.card_description>Dropdown selection from a list of options.</.card_description>
        </.card_header>

        <.card_content align={:center}>
          <.input
            name="list"
            type="select"
            label="Select an item"
            options={["Item 1", "Item 2", "Item 3"]}
            prompt="Select an item"
            value=""
            required
            class="w-full"
          />
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Checkbox Input</.card_title>
          <.card_description>Toggle selection for boolean values.</.card_description>
        </.card_header>

        <.card_content align={:center}>
          <.input type="checkbox" name="accept" label="Accept terms and conditions" value="" />
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Form Field Example</.card_title>
          <.card_description>Using inputs with Phoenix form fields.</.card_description>
        </.card_header>

        <.card_content align={:center}>
          <.form :let={f} for={@form} phx-change="validate" class="flex flex-col gap-4">
            <.input field={f[:username]} label="Username" required class="w-full" />
            <.input field={f[:password]} type="password" label="Password" required class="w-full" />
          </.form>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Input with Error</.card_title>
          <.card_description>Display validation errors with input fields.</.card_description>
        </.card_header>

        <.card_content align={:center}>
          <.input
            name="email_error"
            label="Email address"
            value="invalid-email"
            errors={["Please enter a valid email address."]}
            class="w-full"
          />
        </.card_content>
      </.card>
    </article>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket =
      socket
      |> assign(:page_title, "Input")
      |> assign(:form, to_form(%{"username" => "", "password" => ""}))

    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def handle_event("validate", _params, socket) do
    {:noreply, socket}
  end
end
