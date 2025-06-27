defmodule Zoonk.Stripe.WebhookSignature do
  @moduledoc """
  Signing and verifying Stripe webhook signatures.

  Forked from the [Dashbit blog](https://dashbit.co/blog/sdks-with-req-stripe).
  """
  @schema "v1"
  @valid_period_in_seconds 300

  @doc """
  Signs payload with timestamp and secret.
  """
  def sign(payload, timestamp, secret) do
    signature = "#{@schema}=" <> hash(timestamp, payload, secret)
    "t=#{timestamp}," <> signature
  end

  @doc """
  Verifies payload against signature and secret.
  """
  def verify(payload, signature, secret) do
    with {:ok, timestamp, hash} <- parse(signature, @schema) do
      current_timestamp = System.system_time(:second)

      cond do
        timestamp + @valid_period_in_seconds < current_timestamp ->
          {:error, "signature is expired"}

        not Plug.Crypto.secure_compare(hash, hash(timestamp, payload, secret)) ->
          {:error, "signature is incorrect"}

        true ->
          :ok
      end
    end
  end

  defp parse(signature, schema) do
    parsed =
      for pair <- String.split(signature, ","),
          destructure([key, value], String.split(pair, "=", parts: 2)),
          do: {key, value},
          into: %{}

    with %{"t" => timestamp, ^schema => hash} <- parsed,
         {timestamp, ""} <- Integer.parse(timestamp) do
      {:ok, timestamp, hash}
    else
      _invalid -> {:error, "signature is in a wrong format or is missing #{schema} schema"}
    end
  end

  defp hash(timestamp, payload, secret) do
    :hmac
    |> :crypto.mac(:sha256, secret, ["#{timestamp}.", payload])
    |> Base.encode16(case: :lower)
  end
end
