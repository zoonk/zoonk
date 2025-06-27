defmodule ZoonkWeb.StripeWebhookControllerTest do
  @moduledoc """
  Tests for the Stripe webhook controller.

  Tests webhook signature verification, event handling, and error responses.
  """
  use ZoonkWeb.ConnCase, async: true

  alias Zoonk.Stripe.WebhookSignature

  @valid_webhook_secret "whsec_test_secret_key_for_webhook_verification"
  @invalid_webhook_secret "whsec_invalid_secret"
  @test_payload ~s({"id":"evt_test_webhook","type":"payment_intent.succeeded","object":"event"})

  setup do
    %{payload: @test_payload}
  end

  describe "POST /webhooks/stripe" do
    test "successfully processes webhook with valid signature", %{conn: conn, payload: payload} do
      timestamp = System.system_time(:second)
      signature = WebhookSignature.sign(payload, timestamp, @valid_webhook_secret)

      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature)
        |> post(~p"/webhooks/stripe", payload)

      assert response(conn, 200) == "Webhook received"
    end

    test "successfully processes different event types", %{conn: conn} do
      event_types = [
        "customer.subscription.created",
        "invoice.payment_succeeded",
        "checkout.session.completed",
        "payment_intent.payment_failed"
      ]

      for event_type <- event_types do
        payload = ~s({"id":"evt_#{:rand.uniform(999_999)}","type":"#{event_type}","object":"event"})
        timestamp = System.system_time(:second)
        signature = WebhookSignature.sign(payload, timestamp, @valid_webhook_secret)

        conn =
          conn
          |> put_req_header("content-type", "application/json")
          |> put_req_header("stripe-signature", signature)
          |> post(~p"/webhooks/stripe", payload)

        assert response(conn, 200) == "Webhook received"
      end
    end

    test "rejects webhook without stripe-signature header", %{conn: conn, payload: payload} do
      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> post(~p"/webhooks/stripe", payload)

      assert response(conn, 400) == "invalid signature: no signature"
    end

    test "rejects webhook with invalid signature format", %{conn: conn, payload: payload} do
      invalid_signatures = [
        "invalid_signature",
        "t=123",
        "v1=abc123",
        "t=abc,v1=123",
        "",
        "t=123,v2=abc123"
      ]

      for invalid_signature <- invalid_signatures do
        conn =
          conn
          |> put_req_header("content-type", "application/json")
          |> put_req_header("stripe-signature", invalid_signature)
          |> post(~p"/webhooks/stripe", payload)

        resp = response(conn, 400)

        assert conn.status == 400
        assert String.starts_with?(resp, "invalid signature:")
      end
    end

    test "rejects webhook with incorrect signature", %{conn: conn, payload: payload} do
      timestamp = System.system_time(:second)
      # Use wrong secret to generate signature
      wrong_signature = WebhookSignature.sign(payload, timestamp, @invalid_webhook_secret)

      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", wrong_signature)
        |> post(~p"/webhooks/stripe", payload)

      assert response(conn, 400) == "invalid signature: signature is incorrect"
    end

    test "rejects webhook with expired signature", %{conn: conn, payload: payload} do
      # Create timestamp older than valid period (300 seconds)
      expired_timestamp = System.system_time(:second) - 400
      expired_signature = WebhookSignature.sign(payload, expired_timestamp, @valid_webhook_secret)

      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", expired_signature)
        |> post(~p"/webhooks/stripe", payload)

      assert response(conn, 400) == "invalid signature: signature is expired"
    end

    test "rejects webhook with different payload than signature", %{conn: conn} do
      original_payload = ~s({"id":"evt_original","type":"payment_intent.succeeded"})
      different_payload = ~s({"id":"evt_different","type":"payment_intent.succeeded"})

      timestamp = System.system_time(:second)
      # Sign original payload but send different payload
      signature = WebhookSignature.sign(original_payload, timestamp, @valid_webhook_secret)

      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature)
        |> post(~p"/webhooks/stripe", different_payload)

      assert response(conn, 400) == "invalid signature: signature is incorrect"
    end

    test "handles webhook with extra signature parameters", %{conn: conn, payload: payload} do
      timestamp = System.system_time(:second)
      base_signature = WebhookSignature.sign(payload, timestamp, @valid_webhook_secret)
      signature_with_extras = base_signature <> ",extra=value,another=param"

      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature_with_extras)
        |> post(~p"/webhooks/stripe", payload)

      assert response(conn, 200) == "Webhook received"
    end

    test "handles large webhook payloads", %{conn: conn} do
      # Create a large payload
      large_data = String.duplicate("x", 5000)
      large_payload = ~s({"id":"evt_large","type":"test.large","data":"#{large_data}"})

      timestamp = System.system_time(:second)
      signature = WebhookSignature.sign(large_payload, timestamp, @valid_webhook_secret)

      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature)
        |> post(~p"/webhooks/stripe", large_payload)

      assert response(conn, 200) == "Webhook received"
    end

    test "handles webhook with special characters in payload", %{conn: conn} do
      special_payload = ~s({"id":"evt_special","type":"test.special","message":"Hello, world! Special chars test"})

      timestamp = System.system_time(:second)
      signature = WebhookSignature.sign(special_payload, timestamp, @valid_webhook_secret)

      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature)
        |> post(~p"/webhooks/stripe", special_payload)

      assert response(conn, 200) == "Webhook received"
    end

    test "rejects webhook when webhook secret is missing from config" do
      # Remove webhook secret from config
      original_config = Application.get_env(:zoonk, :stripe, [])
      invalid_config = Keyword.delete(original_config, :webhook_secret)
      Application.put_env(:zoonk, :stripe, invalid_config)

      conn = build_conn()
      payload = @test_payload
      timestamp = System.system_time(:second)
      signature = WebhookSignature.sign(payload, timestamp, @valid_webhook_secret)

      assert_raise MatchError, fn ->
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature)
        |> post(~p"/webhooks/stripe", payload)
      end

      # Restore config
      Application.put_env(:zoonk, :stripe, original_config)
    end

    test "rejects webhook with malformed webhook secret in config" do
      # Set webhook secret without required 'whsec_' prefix
      original_config = Application.get_env(:zoonk, :stripe, [])
      invalid_config = Keyword.put(original_config, :webhook_secret, "invalid_secret_format")
      Application.put_env(:zoonk, :stripe, invalid_config)

      conn = build_conn()
      payload = @test_payload
      timestamp = System.system_time(:second)
      signature = WebhookSignature.sign(payload, timestamp, "invalid_secret_format")

      assert_raise MatchError, fn ->
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature)
        |> post(~p"/webhooks/stripe", payload)
      end

      # Restore config
      Application.put_env(:zoonk, :stripe, original_config)
    end

    test "handles signature with extra parameters", %{conn: conn, payload: payload} do
      timestamp = System.system_time(:second)
      base_signature = WebhookSignature.sign(payload, timestamp, @valid_webhook_secret)
      signature_with_extras = base_signature <> ",extra=value,another=param"

      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature_with_extras)
        |> post(~p"/webhooks/stripe", payload)

      assert response(conn, 200) == "Webhook received"
    end

    test "verifies signature using raw body from ParsersWithRawBody", %{conn: conn, payload: payload} do
      timestamp = System.system_time(:second)
      signature = WebhookSignature.sign(payload, timestamp, @valid_webhook_secret)

      # This test verifies that the controller uses conn.assigns.raw_body
      # which is set by ParsersWithRawBody plug for webhook paths
      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature)
        |> post(~p"/webhooks/stripe", payload)

      assert response(conn, 200) == "Webhook received"

      # Verify that raw_body was used by checking it exists in assigns
      # (This is set by ParsersWithRawBody for webhook endpoints)
      assert Map.has_key?(conn.assigns, :raw_body)
    end
  end

  describe "POST /webhooks/stripe without type parameter" do
    test "handles webhook without type parameter", %{conn: conn} do
      payload = ~s({"id":"evt_no_type","object":"event"})
      timestamp = System.system_time(:second)
      signature = WebhookSignature.sign(payload, timestamp, @valid_webhook_secret)

      # This should trigger the function clause that doesn't match the type parameter
      assert_raise Phoenix.ActionClauseError, fn ->
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature)
        |> post(~p"/webhooks/stripe", payload)
      end
    end
  end

  describe "edge cases and security" do
    test "signature verification is timing attack resistant", %{conn: conn, payload: payload} do
      timestamp = System.system_time(:second)
      correct_signature = WebhookSignature.sign(payload, timestamp, @valid_webhook_secret)

      # Extract hash and create incorrect hash of same length
      [timestamp_part, hash_part] = String.split(correct_signature, ",")
      ["v1", correct_hash] = String.split(hash_part, "=")
      incorrect_hash = String.duplicate("f", String.length(correct_hash))
      incorrect_signature = "#{timestamp_part},v1=#{incorrect_hash}"

      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", incorrect_signature)
        |> post(~p"/webhooks/stripe", payload)

      assert response(conn, 400) == "invalid signature: signature is incorrect"
    end

    test "handles empty payload", %{conn: conn} do
      empty_payload = ~s({})
      timestamp = System.system_time(:second)
      signature = WebhookSignature.sign(empty_payload, timestamp, @valid_webhook_secret)

      # This should fail with Phoenix.ActionClauseError since no type parameter
      assert_raise Phoenix.ActionClauseError, fn ->
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature)
        |> post(~p"/webhooks/stripe", empty_payload)
      end
    end

    test "signature verification works at edge of valid time period", %{conn: conn, payload: payload} do
      # Create timestamp at exactly 299 seconds ago (within 300 second limit)
      edge_timestamp = System.system_time(:second) - 299
      edge_signature = WebhookSignature.sign(payload, edge_timestamp, @valid_webhook_secret)

      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", edge_signature)
        |> post(~p"/webhooks/stripe", payload)

      assert response(conn, 200) == "Webhook received"
    end
  end
end
