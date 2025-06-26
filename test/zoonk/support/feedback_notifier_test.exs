defmodule Zoonk.Support.FeedbackNotifierTest do
  use Zoonk.DataCase, async: true

  alias Zoonk.Config.SupportConfig
  alias Zoonk.Support.FeedbackNotifier

  describe "deliver_feedback/2" do
    test "delivers feedback email with correct recipient and content" do
      user_email = "user@example.com"
      message = "This is a great app! I love using it every day."

      assert {:ok, email} = FeedbackNotifier.deliver_feedback(user_email, message)

      # Check email structure
      assert email.to == [{"", SupportConfig.support_email()}]
      assert email.from == {"Zoonk", SupportConfig.support_email()}
      assert email.subject == "Feedback"
      assert email.text_body =~ "From: #{user_email}"
      assert email.text_body =~ "Message:\n#{message}"
    end

    test "delivers feedback with special characters in message" do
      user_email = "test@example.com"
      message = "Special chars: äöü @#$%^&*()_+ and newlines\nwork fine!"

      assert {:ok, email} = FeedbackNotifier.deliver_feedback(user_email, message)

      assert email.text_body =~ message
      assert email.subject == "Feedback"
    end
  end
end
