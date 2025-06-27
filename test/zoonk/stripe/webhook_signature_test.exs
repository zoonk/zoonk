defmodule Zoonk.Stripe.WebhookSignatureTest do
  use ExUnit.Case, async: true

  alias Zoonk.Stripe.WebhookSignature

  @secret "test_webhook_secret"
  @payload ~s({"id":"evt_test_webhook","object":"event"})
  @current_timestamp System.system_time(:second)

  describe "sign/3" do
    test "creates a valid signature for given payload, timestamp, and secret" do
      timestamp = @current_timestamp
      signature = WebhookSignature.sign(@payload, timestamp, @secret)

      assert signature =~ ~r/^t=\d+,v1=[a-f0-9]{64}$/
      assert String.starts_with?(signature, "t=#{timestamp},v1=")
    end

    test "generates different signatures for different payloads" do
      timestamp = @current_timestamp
      payload1 = ~s({"id":"evt_1","data":{"key":"value1"}})
      payload2 = ~s({"id":"evt_2","data":{"key":"value2"}})

      signature1 = WebhookSignature.sign(payload1, timestamp, @secret)
      signature2 = WebhookSignature.sign(payload2, timestamp, @secret)

      refute signature1 == signature2
    end

    test "generates different signatures for different timestamps" do
      timestamp1 = @current_timestamp
      timestamp2 = @current_timestamp + 10

      signature1 = WebhookSignature.sign(@payload, timestamp1, @secret)
      signature2 = WebhookSignature.sign(@payload, timestamp2, @secret)

      refute signature1 == signature2
    end

    test "generates different signatures for different secrets" do
      timestamp = @current_timestamp
      secret1 = "secret_1"
      secret2 = "secret_2"

      signature1 = WebhookSignature.sign(@payload, timestamp, secret1)
      signature2 = WebhookSignature.sign(@payload, timestamp, secret2)

      refute signature1 == signature2
    end
  end

  describe "verify/3" do
    test "successfully verifies a valid signature" do
      timestamp = @current_timestamp
      signature = WebhookSignature.sign(@payload, timestamp, @secret)

      assert :ok = WebhookSignature.verify(@payload, signature, @secret)
    end

    test "fails verification with incorrect payload" do
      timestamp = @current_timestamp
      signature = WebhookSignature.sign(@payload, timestamp, @secret)
      wrong_payload = ~s({"id":"evt_wrong","object":"event"})

      assert {:error, "signature is incorrect"} =
               WebhookSignature.verify(wrong_payload, signature, @secret)
    end

    test "fails verification with incorrect secret" do
      timestamp = @current_timestamp
      signature = WebhookSignature.sign(@payload, timestamp, @secret)
      wrong_secret = "wrong_secret"

      assert {:error, "signature is incorrect"} =
               WebhookSignature.verify(@payload, signature, wrong_secret)
    end

    test "fails verification with expired timestamp" do
      # Create a timestamp that's older than the valid period (300 seconds)
      expired_timestamp = @current_timestamp - 400
      signature = WebhookSignature.sign(@payload, expired_timestamp, @secret)

      assert {:error, "signature is expired"} =
               WebhookSignature.verify(@payload, signature, @secret)
    end

    test "fails verification with malformed signature format" do
      malformed_signatures = [
        "invalid_signature",
        "t=123",
        "v1=abc123",
        "t=abc,v1=123",
        "",
        # wrong schema version
        "t=123,v2=abc123",
        # wrong timestamp key
        "timestamp=123,v1=abc123"
      ]

      for malformed_signature <- malformed_signatures do
        assert {:error, message} = WebhookSignature.verify(@payload, malformed_signature, @secret)
        assert message =~ "signature is in a wrong format or is missing v1 schema"
      end
    end

    test "fails verification with non-numeric timestamp" do
      malformed_signature = "t=not_a_number,v1=abc123"

      assert {:error, "signature is in a wrong format or is missing v1 schema"} =
               WebhookSignature.verify(@payload, malformed_signature, @secret)
    end

    test "handles signature with extra parameters" do
      timestamp = @current_timestamp
      # Create a base signature and add extra parameters
      base_signature = WebhookSignature.sign(@payload, timestamp, @secret)
      signature_with_extras = base_signature <> ",extra=value,another=param"

      assert :ok = WebhookSignature.verify(@payload, signature_with_extras, @secret)
    end

    test "handles signature with parameters in different order" do
      timestamp = @current_timestamp
      # Manually construct signature with v1 before t
      hash =
        :hmac
        |> :crypto.mac(:sha256, @secret, ["#{timestamp}.", @payload])
        |> Base.encode16(case: :lower)

      reordered_signature = "v1=#{hash},t=#{timestamp}"

      assert :ok = WebhookSignature.verify(@payload, reordered_signature, @secret)
    end
  end

  describe "integration test with real Stripe-like scenarios" do
    test "verifies signature that matches Stripe's webhook format" do
      # This simulates what a real Stripe webhook might look like
      stripe_payload = ~s({
        "id": "evt_1234567890",
        "object": "event",
        "api_version": "2020-08-27",
        "created": 1609459200,
        "data": {
          "object": {
            "id": "sub_1234567890",
            "object": "subscription"
          }
        },
        "type": "customer.subscription.created"
      })

      timestamp = @current_timestamp
      signature = WebhookSignature.sign(stripe_payload, timestamp, @secret)

      assert :ok = WebhookSignature.verify(stripe_payload, signature, @secret)
    end

    test "handles empty payload" do
      empty_payload = ""
      timestamp = @current_timestamp
      signature = WebhookSignature.sign(empty_payload, timestamp, @secret)

      assert :ok = WebhookSignature.verify(empty_payload, signature, @secret)
    end

    test "handles payload with special characters" do
      special_payload = ~s[{"message":"Hello, 世界! Special chars: @#$%^&*()\[{}|;,./<>?"}]
      timestamp = @current_timestamp
      signature = WebhookSignature.sign(special_payload, timestamp, @secret)

      assert :ok = WebhookSignature.verify(special_payload, signature, @secret)
    end

    test "handles very long payload" do
      long_payload = String.duplicate("a", 10_000)
      timestamp = @current_timestamp
      signature = WebhookSignature.sign(long_payload, timestamp, @secret)

      assert :ok = WebhookSignature.verify(long_payload, signature, @secret)
    end
  end

  describe "edge cases and security considerations" do
    test "timing attack resistance with secure_compare" do
      timestamp = @current_timestamp
      correct_signature = WebhookSignature.sign(@payload, timestamp, @secret)

      # Extract the hash part from the signature
      [_timestamp_part, hash_part] = String.split(correct_signature, ",")
      ["v1", correct_hash] = String.split(hash_part, "=")

      # Create an incorrect hash of the same length
      incorrect_hash = String.duplicate("f", String.length(correct_hash))
      incorrect_signature = "t=#{timestamp},v1=#{incorrect_hash}"

      assert {:error, "signature is incorrect"} =
               WebhookSignature.verify(@payload, incorrect_signature, @secret)
    end

    test "handles multiple v1 parameters (uses last one)" do
      timestamp = @current_timestamp
      correct_signature = WebhookSignature.sign(@payload, timestamp, @secret)

      # Extract the hash part
      [timestamp_part, hash_part] = String.split(correct_signature, ",")

      # Add a second v1 parameter with wrong hash (this will be overwritten by the correct one)
      signature_with_duplicate = "#{timestamp_part},v1=wronghash,#{hash_part}"

      # Should use the last v1 parameter and succeed
      assert :ok = WebhookSignature.verify(@payload, signature_with_duplicate, @secret)
    end

    test "handles whitespace in signature parameters" do
      timestamp = @current_timestamp
      base_signature = WebhookSignature.sign(@payload, timestamp, @secret)

      # Add spaces around the signature (this would be malformed in real usage)
      # But let's test that our parsing handles it gracefully
      [timestamp_part, hash_part] = String.split(base_signature, ",")
      malformed_signature = " #{timestamp_part} , #{hash_part} "

      # This should fail because of malformed format
      assert {:error, _message} = WebhookSignature.verify(@payload, malformed_signature, @secret)
    end
  end
end
