defmodule Zoonk.SupportTest do
  use Zoonk.DataCase, async: true

  alias Zoonk.Support

  describe "send_feedback/2" do
    test "sends feedback with valid data" do
      user_email = "user@example.com"
      message = "This is a great app! I love using it."

      assert {:ok, :sent} = Support.send_feedback(user_email, message)
    end

    test "returns error with invalid email" do
      invalid_email = "invalid-email"
      message = "This is a valid message with enough characters."

      assert {:error, changeset} = Support.send_feedback(invalid_email, message)
      assert "has invalid format" in errors_on(changeset).email
    end

    test "returns error with empty email" do
      message = "This is a valid message with enough characters."

      assert {:error, changeset} = Support.send_feedback("", message)
      assert "can't be blank" in errors_on(changeset).email
    end

    test "returns error with empty message" do
      user_email = "user@example.com"

      assert {:error, changeset} = Support.send_feedback(user_email, "")
      assert "can't be blank" in errors_on(changeset).message
    end

    test "returns error with message too short" do
      user_email = "user@example.com"
      short_message = "short"

      assert {:error, changeset} = Support.send_feedback(user_email, short_message)
      assert "should be at least 10 character(s)" in errors_on(changeset).message
    end
  end

  describe "change_feedback/1" do
    test "returns a changeset with valid data" do
      attrs = %{email: "user@example.com", message: "This is a valid message."}

      changeset = Support.change_feedback(attrs)

      assert changeset.valid?
      assert changeset.changes.email == "user@example.com"
      assert changeset.changes.message == "This is a valid message."
    end

    test "returns a changeset with empty data" do
      changeset = Support.change_feedback(%{})

      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).email
      assert "can't be blank" in errors_on(changeset).message
    end

    test "validates email format" do
      attrs = %{email: "invalid-email", message: "This is a valid message."}

      changeset = Support.change_feedback(attrs)

      refute changeset.valid?
      assert "has invalid format" in errors_on(changeset).email
    end

    test "validates message length" do
      attrs = %{email: "user@example.com", message: "short"}

      changeset = Support.change_feedback(attrs)

      refute changeset.valid?
      assert "should be at least 10 character(s)" in errors_on(changeset).message
    end
  end

  describe "send_support_request/2" do
    test "sends support request with valid data" do
      user_email = "user@example.com"
      message = "I'm having trouble logging into my account. Please help me."

      assert {:ok, :sent} = Support.send_support_request(user_email, message)
    end

    test "returns error with invalid email" do
      invalid_email = "invalid-email"
      message = "This is a valid support request message with enough characters."

      assert {:error, changeset} = Support.send_support_request(invalid_email, message)
      assert "has invalid format" in errors_on(changeset).email
    end

    test "returns error with empty email" do
      message = "This is a valid support request message with enough characters."

      assert {:error, changeset} = Support.send_support_request("", message)
      assert "can't be blank" in errors_on(changeset).email
    end

    test "returns error with empty message" do
      user_email = "user@example.com"

      assert {:error, changeset} = Support.send_support_request(user_email, "")
      assert "can't be blank" in errors_on(changeset).message
    end

    test "returns error with message too short" do
      user_email = "user@example.com"
      short_message = "short message"

      assert {:error, changeset} = Support.send_support_request(user_email, short_message)
      assert "should be at least 15 character(s)" in errors_on(changeset).message
    end
  end

  describe "change_support_request/1" do
    test "returns a changeset with valid data" do
      attrs = %{email: "user@example.com", message: "This is a valid support request message."}

      changeset = Support.change_support_request(attrs)

      assert changeset.valid?
      assert changeset.changes.email == "user@example.com"
      assert changeset.changes.message == "This is a valid support request message."
    end

    test "returns a changeset with empty data" do
      changeset = Support.change_support_request(%{})

      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).email
      assert "can't be blank" in errors_on(changeset).message
    end

    test "validates email format" do
      attrs = %{email: "invalid-email", message: "This is a valid support request message."}

      changeset = Support.change_support_request(attrs)

      refute changeset.valid?
      assert "has invalid format" in errors_on(changeset).email
    end

    test "validates message length" do
      attrs = %{email: "user@example.com", message: "short"}

      changeset = Support.change_support_request(attrs)

      refute changeset.valid?
      assert "should be at least 15 character(s)" in errors_on(changeset).message
    end
  end
end
