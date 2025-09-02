defmodule ZoonkWeb.UIPreview.RadioPreviewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.UIPreview.UIPreviewLayout.render active_page={:radio} page_title={@page_title}>
      <.card>
        <.card_header>
          <.card_title>Radio Input</.card_title>
          <.card_description>
            Radio inputs styled as cards that can be combined with info card components.
          </.card_description>
        </.card_header>

        <.card_content class="flex flex-col gap-4">
          <.radio_input name="subscription" value="feature_1" label="Feature 1">
            <.radio_header>
              <.radio_title>Feature 1</.radio_title>
            </.radio_header>

            <.info_description>
              This is a description of the first feature option.
            </.info_description>

            <.info_list>
              <.info_list_item icon="tabler-check">
                Access to basic features
              </.info_list_item>

              <.info_list_item icon="tabler-check">
                Standard support
              </.info_list_item>
            </.info_list>
          </.radio_input>

          <.radio_input name="subscription" value="feature_2" label="Feature 2" checked>
            <.radio_header>
              <.radio_title badge_label="Popular">Feature 2</.radio_title>
            </.radio_header>

            <.info_description>
              This is a description of the second feature option with a popular badge.
            </.info_description>

            <.info_list>
              <.info_list_item icon="tabler-check">
                Access to all features
              </.info_list_item>

              <.info_list_item icon="tabler-check">
                Priority support
              </.info_list_item>

              <.info_list_item icon="tabler-check">
                Advanced analytics
              </.info_list_item>
            </.info_list>
          </.radio_input>

          <.radio_input name="subscription" value="feature_3" label="Feature 3">
            <.radio_header>
              <.radio_title badge_label="Pro" badge_color={:secondary}>Feature 3</.radio_title>
            </.radio_header>

            <.info_description>
              This is a description of the third feature option with a pro badge.
            </.info_description>

            <.info_list>
              <.info_list_item icon="tabler-check">
                Everything in Feature 2
              </.info_list_item>

              <.info_list_item icon="tabler-check">
                Dedicated account manager
              </.info_list_item>

              <.info_list_item icon="tabler-check">
                Custom integrations
              </.info_list_item>

              <.info_list_item icon="tabler-check">
                White-label options
              </.info_list_item>
            </.info_list>
          </.radio_input>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Simple Radio Options</.card_title>
          <.card_description>Radio inputs without additional content.</.card_description>
        </.card_header>

        <.card_content class="flex flex-col gap-4">
          <.radio_input name="plan" value="basic" label="Basic Plan">
            <.radio_header>
              <.radio_title>Basic Plan</.radio_title>
            </.radio_header>

            <.info_description>
              Perfect for getting started with our platform.
            </.info_description>
          </.radio_input>

          <.radio_input name="plan" value="pro" label="Pro Plan" checked>
            <.radio_header>
              <.radio_title>Pro Plan</.radio_title>
            </.radio_header>

            <.info_description>
              Ideal for growing businesses and teams.
            </.info_description>
          </.radio_input>

          <.radio_input name="plan" value="enterprise" label="Enterprise Plan">
            <.radio_header>
              <.radio_title>Enterprise Plan</.radio_title>
            </.radio_header>

            <.info_description>
              Advanced features for large organizations.
            </.info_description>
          </.radio_input>
        </.card_content>
      </.card>
    </ZoonkWeb.UIPreview.UIPreviewLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    {:ok, assign(socket, page_title: "Radio Input")}
  end
end
