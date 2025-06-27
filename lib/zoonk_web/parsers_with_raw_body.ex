defmodule ZoonkWeb.ParsersWithRawBody do
  @moduledoc """
  A Plug that keeps the raw body of incoming requests.

  This is useful for webhooks where we need to keep
  the raw body around allowing us to calculate signatures.

  This plug replaces the default's body reader in `Plug.Parsers`.

  Forked from the [Dashbit blog](https://dashbit.co/blog/sdks-with-req-stripe).
  """
  @behaviour Plug

  def init(opts) do
    cache = Plug.Parsers.init([body_reader: {__MODULE__, :cache_raw_body, []}] ++ opts)
    nocache = Plug.Parsers.init(opts)
    {cache, nocache}
  end

  def call(%{path_info: ["webhooks" | _rest]} = conn, {cache, _nocache}) do
    Plug.Parsers.call(conn, cache)
  end

  def call(conn, {_cache, nocache}) do
    Plug.Parsers.call(conn, nocache)
  end

  @doc false
  def cache_raw_body(conn, opts) do
    with {:ok, body, conn} <- Plug.Conn.read_body(conn, opts) do
      conn = update_in(conn.assigns[:raw_body], &[body | &1 || []])
      {:ok, body, conn}
    end
  end
end
