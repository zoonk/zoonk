defmodule Zoonk.Support.SupportNotifierTest do
  use Zoonk.DataCase, async: true

  alias Zoonk.Support.SupportNotifier

  describe "deliver_support_request/2" do
    test "delivers support request email with correct recipient and content" do
      user_email = "user@example.com"
      message = "I'm having trouble logging into my account. Please help."

      assert {:ok, email} = SupportNotifier.deliver_support_request(user_email, message)

      # Check email structure
      assert email.to == [{"", "hello@zoonk.com"}]
      assert email.from == {"Zoonk", "hello@zoonk.com"}
      assert email.subject =~ "Support request"
      assert email.text_body =~ "From: #{user_email}"
      assert email.text_body =~ "Message:\n#{message}"
    end

    test "delivers support request with special characters in message" do
      user_email = "test@example.com"
      message = "Special chars: äöü @#$%^&*()_+ and newlines\nwork fine in support requests!"

      assert {:ok, email} = SupportNotifier.deliver_support_request(user_email, message)

      assert email.text_body =~ message
      assert email.subject =~ "Support request"
    end
  end
end
