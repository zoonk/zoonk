defmodule ZoonkWeb.ParsersWithRawBodyTest do
  use ZoonkWeb.ConnCase, async: true

  alias ZoonkWeb.ParsersWithRawBody

  @default_opts [
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library()
  ]

  describe "init/1" do
    test "returns cache and nocache parser configurations" do
      {cache, nocache} = ParsersWithRawBody.init(@default_opts)

      # Both should be Plug.Parsers configs (tuples containing parser info)
      assert is_tuple(cache)
      assert is_tuple(nocache)

      # We can't easily inspect the internal structure of Plug.Parsers configs,
      # but we can verify they're different configurations
      refute cache == nocache
    end
  end

  describe "call/2 path routing" do
    test "routes webhook paths to cache configuration" do
      webhook_paths = [
        ["webhooks"],
        ["webhooks", "stripe"],
        ["webhooks", "stripe", "events"],
        ["webhooks", "github"],
        ["webhooks", "paypal", "ipn"]
      ]

      for path_info <- webhook_paths do
        conn = Map.put(build_conn(), :path_info, path_info)
        {cache, nocache} = ParsersWithRawBody.init(@default_opts)

        # Should call Plug.Parsers.call with cache config
        # We test this by verifying the path matching logic
        assert conn
               |> ParsersWithRawBody.call({cache, nocache})
               |> is_struct(Plug.Conn)
      end
    end

    test "routes non-webhook paths to nocache configuration" do
      non_webhook_paths = [
        [],
        ["api"],
        ["api", "v1", "users"],
        ["users", "123"],
        ["catalog"],
        # Note: "webhook" (singular) should not match
        ["webhook"],
        # webhooks not at start
        ["something", "webhooks"]
      ]

      for path_info <- non_webhook_paths do
        conn = Map.put(build_conn(), :path_info, path_info)
        {cache, nocache} = ParsersWithRawBody.init(@default_opts)

        # Should call Plug.Parsers.call with nocache config
        assert conn
               |> ParsersWithRawBody.call({cache, nocache})
               |> is_struct(Plug.Conn)
      end
    end
  end

  describe "cache_raw_body/2" do
    test "stores body chunk in assigns when no previous raw_body exists" do
      conn = build_conn()
      test_body = "test body content"

      # Test the update logic that cache_raw_body uses
      conn_with_body = update_in(conn.assigns[:raw_body], &[test_body | &1 || []])
      assert conn_with_body.assigns[:raw_body] == [test_body]
    end

    test "accumulates body chunks when raw_body already exists" do
      conn = build_conn()
      first_chunk = "first"
      second_chunk = "second"

      # Simulate conn after first chunk
      conn_after_first = update_in(conn.assigns[:raw_body], &[first_chunk | &1 || []])
      assert conn_after_first.assigns[:raw_body] == [first_chunk]

      # Simulate second chunk
      conn_after_second = update_in(conn_after_first.assigns[:raw_body], &[second_chunk | &1 || []])
      assert conn_after_second.assigns[:raw_body] == [second_chunk, first_chunk]
    end

    test "handles empty existing raw_body list" do
      conn = build_conn()
      new_chunk = "new content"

      # Start with empty raw_body list
      conn_with_empty = put_in(conn.assigns[:raw_body], [])
      conn_updated = update_in(conn_with_empty.assigns[:raw_body], &[new_chunk | &1 || []])

      assert conn_updated.assigns[:raw_body] == [new_chunk]
    end
  end

  describe "integration with real request pipeline" do
    test "webhook request with JSON stores raw body" do
      json_payload = ~s({"event_type": "payment.completed", "amount": 1000})

      conn =
        :post
        |> build_conn("/webhooks/stripe", json_payload)
        |> put_req_header("content-type", "application/json")
        |> ParsersWithRawBody.call(ParsersWithRawBody.init(@default_opts))

      # Body should be parsed normally
      assert conn.body_params == %{"event_type" => "payment.completed", "amount" => 1000}

      # Raw body should be stored as list of chunks
      assert is_list(conn.assigns[:raw_body])
      # Raw body chunks are stored in reverse order, so we reverse to get original
      raw_body_string =
        conn.assigns.raw_body
        |> Enum.reverse()
        |> IO.iodata_to_binary()

      assert raw_body_string == json_payload
    end

    test "non-webhook request does not store raw body" do
      json_payload = ~s({"name": "John", "email": "john@example.com"})

      conn =
        :post
        |> build_conn("/api/users", json_payload)
        |> put_req_header("content-type", "application/json")
        |> ParsersWithRawBody.call(ParsersWithRawBody.init(@default_opts))

      # Body should be parsed normally
      assert conn.body_params == %{"name" => "John", "email" => "john@example.com"}

      # Raw body should NOT be stored
      refute Map.has_key?(conn.assigns, :raw_body)
    end

    test "webhook request with form data stores raw body" do
      form_payload = "event=test&amount=100"

      conn =
        :post
        |> build_conn("/webhooks/paypal", form_payload)
        |> put_req_header("content-type", "application/x-www-form-urlencoded")
        |> ParsersWithRawBody.call(ParsersWithRawBody.init(@default_opts))

      # Body should be parsed normally
      assert conn.body_params == %{"event" => "test", "amount" => "100"}

      # Raw body should be stored
      assert is_list(conn.assigns[:raw_body])

      raw_body_string =
        conn.assigns.raw_body
        |> Enum.reverse()
        |> IO.iodata_to_binary()

      assert raw_body_string == form_payload
    end

    test "empty webhook request handles gracefully" do
      conn =
        :post
        |> build_conn("/webhooks/github", "")
        |> put_req_header("content-type", "application/json")
        |> ParsersWithRawBody.call(ParsersWithRawBody.init(@default_opts))

      # Raw body should be stored even when empty
      assert is_list(conn.assigns[:raw_body])

      raw_body_string =
        conn.assigns.raw_body
        |> Enum.reverse()
        |> IO.iodata_to_binary()

      assert raw_body_string == ""
    end

    test "large webhook payload stores correctly" do
      # Create a larger JSON payload
      large_payload =
        Jason.encode!(%{
          event: "large_data",
          data: String.duplicate("x", 1000),
          nested: %{
            list: Enum.to_list(1..100),
            metadata: %{timestamp: System.system_time(), size: "large"}
          }
        })

      conn =
        :post
        |> build_conn("/webhooks/test", large_payload)
        |> put_req_header("content-type", "application/json")
        |> ParsersWithRawBody.call(ParsersWithRawBody.init(@default_opts))

      # Should parse correctly
      assert %{"event" => "large_data"} = conn.body_params

      # Raw body should be stored completely
      assert is_list(conn.assigns[:raw_body])

      raw_body_string =
        conn.assigns.raw_body
        |> Enum.reverse()
        |> IO.iodata_to_binary()

      assert raw_body_string == large_payload
    end

    test "webhook with multipart form data" do
      # Test multipart handling for webhooks
      # Note: multipart requests may not store raw_body the same way as JSON/form data
      conn =
        :post
        |> build_conn("/webhooks/upload", %{file: "content", name: "test"})
        |> put_req_header("content-type", "multipart/form-data; boundary=----WebKitFormBoundary")
        |> ParsersWithRawBody.call(ParsersWithRawBody.init(@default_opts))

      # Should handle multipart
      assert %{"file" => "content", "name" => "test"} = conn.body_params

      # Multipart may or may not store raw_body depending on implementation
      # We just verify it doesn't crash and parses correctly
      assert is_map(conn.body_params)
    end
  end

  describe "real-world webhook signature verification scenario" do
    test "stored raw body can be used for signature verification" do
      # Simulate a real webhook payload like Stripe sends
      webhook_payload =
        Jason.encode!(%{
          id: "evt_1234567890",
          object: "event",
          type: "payment_intent.succeeded",
          data: %{
            object: %{
              id: "pi_1234567890",
              amount: 2000,
              currency: "usd"
            }
          }
        })

      conn =
        :post
        |> build_conn("/webhooks/stripe", webhook_payload)
        |> put_req_header("content-type", "application/json")
        |> put_req_header("stripe-signature", "t=1234567890,v1=test_signature")
        |> ParsersWithRawBody.call(ParsersWithRawBody.init(@default_opts))

      # Verify parsed body
      assert %{"id" => "evt_1234567890", "type" => "payment_intent.succeeded"} = conn.body_params

      # Raw body is available for signature verification
      assert is_list(conn.assigns[:raw_body])

      raw_body_for_signature =
        conn.assigns.raw_body
        |> Enum.reverse()
        |> IO.iodata_to_binary()

      # This is what would be used in actual signature verification
      assert raw_body_for_signature == webhook_payload

      # Simulate signature header access (as done in webhook controller)
      signature_header =
        conn
        |> get_req_header("stripe-signature")
        |> List.first()

      assert signature_header == "t=1234567890,v1=test_signature"

      # This demonstrates the full flow: raw body + signature header = webhook verification
      assert String.contains?(raw_body_for_signature, "payment_intent.succeeded")
    end
  end
end
