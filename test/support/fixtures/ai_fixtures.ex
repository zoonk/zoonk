defmodule Zoonk.AIFixtures do
  @moduledoc false

  @usage_input 50
  @usage_output 50
  @usage_total @usage_input + @usage_output

  def token_usage do
    %{
      input: @usage_input,
      output: @usage_output,
      total: @usage_total
    }
  end

  def openai_stub(data, opts \\ []) do
    error = Keyword.get(opts, :error, nil)
    refusal = Keyword.get(opts, :refusal, nil)
    output = openai_output(data, refusal)

    Req.Test.stub(:openai_client, fn conn ->
      Req.Test.json(conn, %{
        "error" => error,
        "output" => [
          %{"type" => "reasoning"},
          %{"content" => [output], "type" => "message"}
        ],
        "usage" => %{"input_tokens" => @usage_input, "output_tokens" => @usage_output, "total_tokens" => @usage_total}
      })
    end)
  end

  def togetherai_stub(data, opts \\ []) do
    error = Keyword.get(opts, :error, nil)
    output = togetherai_output(data)

    if error do
      Req.Test.stub(:togetherai_client, fn conn ->
        Req.Test.json(conn, %{"error" => %{"message" => error}})
      end)
    else
      Req.Test.stub(:togetherai_client, fn conn ->
        Req.Test.json(conn, %{
          "choices" => [output],
          "usage" => %{
            "prompt_tokens" => @usage_input,
            "completion_tokens" => @usage_output,
            "total_tokens" => @usage_total
          }
        })
      end)
    end
  end

  def gemini_stub(data, opts \\ []) do
    error = Keyword.get(opts, :error, nil)
    output = gemini_output(data)

    if error do
      Req.Test.stub(:gemini_client, fn conn ->
        Req.Test.json(conn, %{"error" => %{"message" => error}})
      end)
    else
      Req.Test.stub(:gemini_client, fn conn ->
        Req.Test.json(conn, %{
          "candidates" => [output],
          "usageMetadata" => %{
            "promptTokenCount" => @usage_input,
            "candidatesTokenCount" => @usage_output,
            "totalTokenCount" => @usage_total
          }
        })
      end)
    end
  end

  def openrouter_stub(data, opts \\ []) do
    error = Keyword.get(opts, :error, nil)
    output = openrouter_output(data)

    if error do
      Req.Test.stub(:openrouter_client, fn conn ->
        Req.Test.json(conn, %{"error" => %{"message" => error}})
      end)
    else
      Req.Test.stub(:openrouter_client, fn conn ->
        Req.Test.json(conn, %{
          "choices" => [output],
          "usage" => %{
            "prompt_tokens" => @usage_input,
            "completion_tokens" => @usage_output,
            "total_tokens" => @usage_total
          }
        })
      end)
    end
  end

  defp openai_output(data, nil) do
    %{
      "type" => "output_text",
      "text" => JSON.encode!(data)
    }
  end

  defp openai_output(_data, refusal) do
    %{
      "type" => "refusal",
      "refusal" => refusal
    }
  end

  defp togetherai_output(data) do
    %{
      "message" => %{
        "role" => "assistant",
        "content" => JSON.encode!(data)
      }
    }
  end

  defp gemini_output(data) do
    %{
      "content" => %{
        "parts" => [%{"text" => JSON.encode!(data)}]
      }
    }
  end

  defp openrouter_output(data) do
    %{
      "message" => %{
        "role" => "assistant",
        "content" => JSON.encode!(data)
      }
    }
  end
end
