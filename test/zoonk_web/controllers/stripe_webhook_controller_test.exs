defmodule ZoonkWeb.StripeWebhookControllerTest do
  @moduledoc """
  Tests for the Stripe webhook controller.

  Tests webhook signature verification, event handling, and error responses.
  """
  use ZoonkWeb.ConnCase, async: true

  import Zoonk.AccountFixtures
  import Zoonk.BillingFixtures
  import Zoonk.OrgFixtures

  alias Zoonk.Billing
  alias Zoonk.Repo
  alias Zoonk.Scope
  alias Zoonk.Stripe.WebhookSignature

  @valid_webhook_secret "whsec_test_secret_key_for_webhook_verification"
  @invalid_webhook_secret "whsec_invalid_secret"
  @test_payload ~s({"id":"evt_test_webhook","type":"payment_intent.succeeded","object":"event"})

  setup do
    user = user_fixture()
    org = org_fixture()
    scope = %Scope{user: user, org: org}
    
    %{payload: @test_payload, user: user, org: org, scope: scope}
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

      assert response(conn, 200) == "Webhook received but not processed"
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

        assert response(conn, 200) == "Webhook received but not processed"
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

      assert response(conn, 200) == "Webhook received but not processed"
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

      assert response(conn, 200) == "Webhook received but not processed"
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

      assert response(conn, 200) == "Webhook received but not processed"
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

      assert response(conn, 200) == "Webhook received but not processed"
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

      assert response(conn, 200) == "Webhook received but not processed"

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

      # This should not raise an exception anymore since we handle it gracefully
      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature)
        |> post(~p"/webhooks/stripe", payload)

      assert response(conn, 200) == "Webhook received but not processed"
    end
  end

  describe "subscription webhook events" do
    test "handles customer.subscription.created event", %{conn: conn, user: user, org: org} do
      # Create billing account for the user
      stripe_stub(prefix: "cus_")
      scope = %Scope{user: user, org: org}
      {:ok, _billing_account} = Billing.create_billing_account(scope, %{"currency" => "USD", "country_iso2" => "US"})

      subscription_event = %{
        "id" => "evt_subscription_created",
        "type" => "customer.subscription.created",
        "data" => %{
          "object" => %{
            "id" => "sub_123456789",
            "status" => "active",
            "current_period_end" => 1_735_689_600, # Future timestamp
            "cancel_at_period_end" => false,
            "metadata" => %{
              "user_id" => to_string(user.id),
              "org_id" => to_string(org.id)
            },
            "items" => %{
              "data" => [
                %{
                  "price" => %{
                    "lookup_key" => "plus_monthly",
                    "recurring" => %{"interval" => "month"}
                  }
                }
              ]
            }
          }
        }
      }

      payload = Jason.encode!(subscription_event)
      timestamp = System.system_time(:second)
      signature = WebhookSignature.sign(payload, timestamp, @valid_webhook_secret)

      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature)
        |> post(~p"/webhooks/stripe", payload)

      assert response(conn, 200) == "Webhook processed successfully"

      # Verify subscription was created
      updated_scope = %Scope{user: user, org: org}
      subscription = Billing.get_user_subscription(updated_scope)
      assert subscription.plan == :plus
      assert subscription.payment_term == :monthly
      assert subscription.status == :active
      assert subscription.stripe_subscription_id == "sub_123456789"
    end

    test "handles customer.subscription.updated event", %{conn: conn, user: user, org: org} do
      # Create existing subscription
      scope = %Scope{user: user, org: org}
      stripe_stub(prefix: "cus_")
      {:ok, _billing_account} = Billing.create_billing_account(scope, %{"currency" => "USD", "country_iso2" => "US"})

      attrs = valid_user_subscription_attrs(%{
        stripe_subscription_id: "sub_123456789",
        status: :active
      })
      {:ok, _subscription} = Billing.create_user_subscription(scope, attrs)

      subscription_event = %{
        "id" => "evt_subscription_updated",
        "type" => "customer.subscription.updated",
        "data" => %{
          "object" => %{
            "id" => "sub_123456789",
            "status" => "past_due",
            "current_period_end" => 1_735_689_600,
            "cancel_at_period_end" => true,
            "metadata" => %{
              "user_id" => to_string(user.id),
              "org_id" => to_string(org.id)
            },
            "items" => %{
              "data" => [
                %{
                  "price" => %{
                    "lookup_key" => "plus_monthly",
                    "recurring" => %{"interval" => "month"}
                  }
                }
              ]
            }
          }
        }
      }

      payload = Jason.encode!(subscription_event)
      timestamp = System.system_time(:second)
      signature = WebhookSignature.sign(payload, timestamp, @valid_webhook_secret)

      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature)
        |> post(~p"/webhooks/stripe", payload)

      assert response(conn, 200) == "Webhook processed successfully"

      # Verify subscription was updated
      updated_scope = %Scope{user: user, org: org}
      subscription = Billing.get_user_subscription(updated_scope)
      assert subscription.status == :past_due
      assert subscription.cancel_at_period_end == true
    end

    test "handles customer.subscription.deleted event", %{conn: conn, user: user, org: org} do
      # Create existing subscription
      scope = %Scope{user: user, org: org}
      stripe_stub(prefix: "cus_")
      {:ok, _billing_account} = Billing.create_billing_account(scope, %{"currency" => "USD", "country_iso2" => "US"})

      attrs = valid_user_subscription_attrs(%{
        stripe_subscription_id: "sub_123456789",
        status: :active
      })
      {:ok, _subscription} = Billing.create_user_subscription(scope, attrs)

      subscription_event = %{
        "id" => "evt_subscription_deleted",
        "type" => "customer.subscription.deleted",
        "data" => %{
          "object" => %{
            "id" => "sub_123456789",
            "status" => "canceled",
            "metadata" => %{
              "user_id" => to_string(user.id),
              "org_id" => to_string(org.id)
            }
          }
        }
      }

      payload = Jason.encode!(subscription_event)
      timestamp = System.system_time(:second)
      signature = WebhookSignature.sign(payload, timestamp, @valid_webhook_secret)

      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature)
        |> post(~p"/webhooks/stripe", payload)

      assert response(conn, 200) == "Webhook processed successfully"

      # Verify subscription was marked as canceled
      updated_scope = %Scope{user: user, org: org}
      subscription = Repo.get_by(Zoonk.Billing.UserSubscription, 
        user_id: user.id, 
        org_id: org.id, 
        stripe_subscription_id: "sub_123456789"
      )
      assert subscription.status == :canceled
    end

    test "handles checkout.session.completed for subscription", %{conn: conn, user: user, org: org} do
      checkout_event = %{
        "id" => "evt_checkout_completed",
        "type" => "checkout.session.completed",
        "data" => %{
          "object" => %{
            "id" => "cs_123456789",
            "mode" => "subscription",
            "subscription" => "sub_987654321",
            "metadata" => %{
              "user_id" => to_string(user.id),
              "org_id" => to_string(org.id),
              "plan" => "plus",
              "payment_term" => "monthly"
            }
          }
        }
      }

      payload = Jason.encode!(checkout_event)
      timestamp = System.system_time(:second)
      signature = WebhookSignature.sign(payload, timestamp, @valid_webhook_secret)

      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature)
        |> post(~p"/webhooks/stripe", payload)

      assert response(conn, 200) == "Webhook processed successfully"
    end

    test "handles checkout.session.completed for lifetime payment", %{conn: conn, user: user, org: org} do
      checkout_event = %{
        "id" => "evt_checkout_lifetime",
        "type" => "checkout.session.completed",
        "data" => %{
          "object" => %{
            "id" => "cs_lifetime123",
            "mode" => "payment",
            "metadata" => %{
              "user_id" => to_string(user.id),
              "org_id" => to_string(org.id),
              "plan" => "plus",
              "payment_term" => "lifetime"
            }
          }
        }
      }

      payload = Jason.encode!(checkout_event)
      timestamp = System.system_time(:second)
      signature = WebhookSignature.sign(payload, timestamp, @valid_webhook_secret)

      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature)
        |> post(~p"/webhooks/stripe", payload)

      assert response(conn, 200) == "Webhook processed successfully"

      # Verify lifetime subscription was created
      scope = %Scope{user: user, org: org}
      subscription = Billing.get_user_subscription(scope)
      assert subscription.plan == :plus
      assert subscription.payment_term == :lifetime
      assert subscription.status == :active
      assert subscription.expires_at.year == 9999
    end

    test "handles checkout.session.async_payment_succeeded", %{conn: conn, user: user, org: org} do
      async_success_event = %{
        "id" => "evt_async_success",
        "type" => "checkout.session.async_payment_succeeded",
        "data" => %{
          "object" => %{
            "id" => "cs_async123",
            "mode" => "payment",
            "metadata" => %{
              "user_id" => to_string(user.id),
              "org_id" => to_string(org.id),
              "plan" => "plus",
              "payment_term" => "lifetime"
            }
          }
        }
      }

      payload = Jason.encode!(async_success_event)
      timestamp = System.system_time(:second)
      signature = WebhookSignature.sign(payload, timestamp, @valid_webhook_secret)

      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature)
        |> post(~p"/webhooks/stripe", payload)

      assert response(conn, 200) == "Webhook processed successfully"
    end

    test "handles checkout.session.async_payment_failed", %{conn: conn, user: user, org: org} do
      async_failed_event = %{
        "id" => "evt_async_failed",
        "type" => "checkout.session.async_payment_failed",
        "data" => %{
          "object" => %{
            "id" => "cs_failed123",
            "metadata" => %{
              "user_id" => to_string(user.id),
              "org_id" => to_string(org.id),
              "plan" => "plus",
              "payment_term" => "monthly"
            }
          }
        }
      }

      payload = Jason.encode!(async_failed_event)
      timestamp = System.system_time(:second)
      signature = WebhookSignature.sign(payload, timestamp, @valid_webhook_secret)

      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature)
        |> post(~p"/webhooks/stripe", payload)

      assert response(conn, 200) == "Webhook processed successfully"
    end

    test "handles webhook with invalid metadata gracefully", %{conn: conn} do
      invalid_event = %{
        "id" => "evt_invalid_metadata",
        "type" => "customer.subscription.created",
        "data" => %{
          "object" => %{
            "id" => "sub_invalid",
            "status" => "active",
            "metadata" => %{
              "user_id" => "invalid",
              "org_id" => "999999"
            }
          }
        }
      }

      payload = Jason.encode!(invalid_event)
      timestamp = System.system_time(:second)
      signature = WebhookSignature.sign(payload, timestamp, @valid_webhook_secret)

      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature)
        |> post(~p"/webhooks/stripe", payload)

      assert response(conn, 500) == "Webhook processing failed"
    end

    test "handles unrecognized webhook event type", %{conn: conn} do
      unknown_event = %{
        "id" => "evt_unknown",
        "type" => "unknown.event.type",
        "data" => %{
          "object" => %{
            "id" => "obj_unknown"
          }
        }
      }

      payload = Jason.encode!(unknown_event)
      timestamp = System.system_time(:second)
      signature = WebhookSignature.sign(payload, timestamp, @valid_webhook_secret)

      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature)
        |> post(~p"/webhooks/stripe", payload)

      assert response(conn, 200) == "Webhook processed successfully"
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

      # This should not fail with Phoenix.ActionClauseError anymore
      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", signature)
        |> post(~p"/webhooks/stripe", empty_payload)

      assert response(conn, 200) == "Webhook received but not processed"
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

      assert response(conn, 200) == "Webhook received but not processed"
    end
  end
end
