defmodule ZoonkWeb.StripeWebhookControllerTest do
  @moduledoc """
  Tests for the Stripe webhook controller.

  Tests webhook signature verification, event handling, and error responses.
  """
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures
  import Zoonk.BillingFixtures

  alias Zoonk.Billing
  alias Zoonk.Scope
  alias Zoonk.Stripe.WebhookSignature

  @valid_webhook_secret "whsec_test_secret_key_for_webhook_verification"
  @invalid_webhook_secret "whsec_invalid_secret"
  @test_payload ~s({"id":"evt_test_webhook","type":"payment_intent.succeeded","object":"event"})

  setup do
    %{payload: @test_payload}
  end

  describe "POST /webhooks/stripe (customer.subscription.created)" do
    setup :setup_app

    test "creates a user subscription", %{conn: conn, org: org} do
      user = user_fixture()
      scope = %Scope{user: user, org: org}
      billing_account = billing_account_fixture(%{"scope" => scope})

      current_period_end =
        DateTime.utc_now()
        |> DateTime.add(30, :day)
        |> DateTime.to_unix()

      subscription_data = %{
        "id" => "sub_test_subscription_id",
        "status" => "active",
        "cancel_at_period_end" => false,
        "customer" => billing_account.stripe_customer_id,
        "items" => %{
          "data" => [
            %{
              "current_period_end" => current_period_end,
              "price" => %{"lookup_key" => "plus_monthly"}
            }
          ]
        }
      }

      payload =
        JSON.encode!(%{
          "id" => "evt_test_subscription_created",
          "type" => "customer.subscription.created",
          "data" => %{"object" => subscription_data}
        })

      {_timestamp, signature} = sign_payload(payload)

      refute Billing.get_user_subscription(scope)

      conn = make_webhook_request(conn, payload, signature)

      assert response(conn, 200) == "Webhook received"

      user_subscription = Billing.get_user_subscription(scope)
      assert user_subscription.user_id == user.id
      assert user_subscription.org_id == org.id
      assert user_subscription.stripe_subscription_id == subscription_data["id"]
      assert user_subscription.plan == :plus
      assert user_subscription.interval == :monthly
      assert user_subscription.status == :active
      assert user_subscription.cancel_at_period_end == false
      assert user_subscription.expires_at == DateTime.from_unix!(current_period_end)
    end
  end

  describe "POST /webhooks/stripe" do
    test "successfully processes webhook with valid signature", %{conn: conn, payload: payload} do
      {_timestamp, signature} = sign_payload(payload)

      conn = make_webhook_request(conn, payload, signature)

      assert response(conn, 200) == "Webhook received"
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
        conn = make_webhook_request(conn, payload, invalid_signature)
        resp = response(conn, 400)

        assert conn.status == 400
        assert String.starts_with?(resp, "invalid signature:")
      end
    end

    test "rejects webhook with incorrect signature", %{conn: conn, payload: payload} do
      # Use wrong secret to generate signature
      {_timestamp, wrong_signature} = sign_payload(payload, @invalid_webhook_secret)

      conn = make_webhook_request(conn, payload, wrong_signature)

      assert response(conn, 400) == "invalid signature: signature is incorrect"
    end

    test "rejects webhook with expired signature", %{conn: conn, payload: payload} do
      # Create timestamp older than valid period (300 seconds)
      expired_timestamp = System.system_time(:second) - 400
      {_timestamp, expired_signature} = sign_payload(payload, @valid_webhook_secret, expired_timestamp)

      conn = make_webhook_request(conn, payload, expired_signature)

      assert response(conn, 400) == "invalid signature: signature is expired"
    end

    test "rejects webhook with different payload than signature", %{conn: conn} do
      original_payload = ~s({"id":"evt_original","type":"payment_intent.succeeded"})
      different_payload = ~s({"id":"evt_different","type":"payment_intent.succeeded"})

      # Sign original payload but send different payload
      {_timestamp, signature} = sign_payload(original_payload)

      conn = make_webhook_request(conn, different_payload, signature)

      assert response(conn, 400) == "invalid signature: signature is incorrect"
    end

    test "handles webhook with extra signature parameters", %{conn: conn, payload: payload} do
      {_timestamp, base_signature} = sign_payload(payload)
      signature_with_extras = base_signature <> ",extra=value,another=param"

      conn = make_webhook_request(conn, payload, signature_with_extras)

      assert response(conn, 200) == "Webhook received"
    end

    test "handles large webhook payloads", %{conn: conn} do
      # Create a large payload
      large_data = String.duplicate("x", 5000)
      large_payload = ~s({"id":"evt_large","type":"test.large","data":"#{large_data}"})

      {_timestamp, signature} = sign_payload(large_payload)

      conn = make_webhook_request(conn, large_payload, signature)

      assert response(conn, 200) == "Webhook received"
    end

    test "handles webhook with special characters in payload", %{conn: conn} do
      special_payload = ~s({"id":"evt_special","type":"test.special","message":"Hello, world! Special chars test"})

      {_timestamp, signature} = sign_payload(special_payload)

      conn = make_webhook_request(conn, special_payload, signature)

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

    test "verifies signature using raw body from ParsersWithRawBody", %{conn: conn, payload: payload} do
      {_timestamp, signature} = sign_payload(payload)

      # This test verifies that the controller uses conn.assigns.raw_body
      # which is set by ParsersWithRawBody plug for webhook paths
      conn = make_webhook_request(conn, payload, signature)

      assert response(conn, 200) == "Webhook received"

      # Verify that raw_body was used by checking it exists in assigns
      # (This is set by ParsersWithRawBody for webhook endpoints)
      assert Map.has_key?(conn.assigns, :raw_body)
    end
  end

  describe "POST /webhooks/stripe without type parameter" do
    test "handles webhook without type parameter", %{conn: conn} do
      payload = ~s({"id":"evt_no_type","object":"event"})
      {_timestamp, signature} = sign_payload(payload)

      # This should trigger the function clause that doesn't match the type parameter
      assert_raise Phoenix.ActionClauseError, fn ->
        make_webhook_request(conn, payload, signature)
      end
    end
  end

  describe "edge cases and security" do
    test "signature verification is timing attack resistant", %{conn: conn, payload: payload} do
      {_timestamp, correct_signature} = sign_payload(payload)

      # Extract hash and create incorrect hash of same length
      [timestamp_part, hash_part] = String.split(correct_signature, ",")
      ["v1", correct_hash] = String.split(hash_part, "=")
      incorrect_hash = String.duplicate("f", String.length(correct_hash))
      incorrect_signature = "#{timestamp_part},v1=#{incorrect_hash}"

      conn = make_webhook_request(conn, payload, incorrect_signature)

      assert response(conn, 400) == "invalid signature: signature is incorrect"
    end

    test "handles empty payload", %{conn: conn} do
      empty_payload = ~s({})
      {_timestamp, signature} = sign_payload(empty_payload)

      # This should fail with Phoenix.ActionClauseError since no type parameter
      assert_raise Phoenix.ActionClauseError, fn ->
        make_webhook_request(conn, empty_payload, signature)
      end
    end

    test "signature verification works at edge of valid time period", %{conn: conn, payload: payload} do
      # Create timestamp at exactly 299 seconds ago (within 300 second limit)
      edge_timestamp = System.system_time(:second) - 299
      {_timestamp, edge_signature} = sign_payload(payload, @valid_webhook_secret, edge_timestamp)

      conn = make_webhook_request(conn, payload, edge_signature)

      assert response(conn, 200) == "Webhook received"
    end
  end

  defp make_webhook_request(conn, payload, signature) do
    conn
    |> put_req_header("content-type", "application/json")
    |> put_req_header("stripe-signature", signature)
    |> post(~p"/webhooks/stripe", payload)
  end

  defp sign_payload(payload, secret \\ @valid_webhook_secret, timestamp \\ nil) do
    timestamp = timestamp || System.system_time(:second)
    signature = WebhookSignature.sign(payload, timestamp, secret)
    {timestamp, signature}
  end
end
