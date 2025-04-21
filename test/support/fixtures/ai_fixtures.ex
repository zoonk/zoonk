defmodule Zoonk.AIFixtures do
  @moduledoc false

  def openai_stub(data, opts \\ []) do
    error = Keyword.get(opts, :error, nil)
    refusal = Keyword.get(opts, :refusal, nil)
    output = get_openai_output(data, refusal)

    Req.Test.stub(:openai_client, fn conn ->
      Req.Test.json(conn, %{
        "error" => error,
        "output" => [%{"content" => [output]}]
      })
    end)
  end

  defp get_openai_output(data, nil) do
    %{
      "type" => "output_text",
      "text" => JSON.encode!(data)
    }
  end

  defp get_openai_output(_data, refusal) do
    %{
      "type" => "refusal",
      "refusal" => refusal
    }
  end
end
