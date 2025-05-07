defmodule Zoonk.BillingFixtures do
  @moduledoc false

  def stripe_stub(opts \\ [])

  def stripe_stub(error: true) do
    Req.Test.stub(:stripe_client, fn conn ->
      Req.Test.json(conn, %{"error" => %{"message" => "Invalid request"}})
    end)
  end

  def stripe_stub(opts) do
    prefix = Keyword.get(opts, :prefix, "/cust_")
    id = "#{prefix}#{System.unique_integer([:positive])}"
    data = Keyword.get(opts, :data, %{})

    Req.Test.stub(:stripe_client, fn conn ->
      Req.Test.json(conn, Map.merge(%{"id" => id}, data))
    end)
  end
end
