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
    output = get_openai_output(data, refusal)

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
    output = get_togetherai_output(data)

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
    output = get_gemini_output(data)

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
    output = get_openrouter_output(data)

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

  def course_recommendation_fixture(attrs \\ %{}) do
    title = Map.get(attrs, :title, "Data Science")
    description = Map.get(attrs, :description, "A field that uses scientific methods to analyze data.")
    english_title = Map.get(attrs, :english_title, "Data Science")
    icon = Map.get(attrs, :icon, "tabler-ufo")
    data = %{title: title, description: description, english_title: english_title, icon: icon}

    openai_stub(%{courses: [data]})

    data
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

  defp get_togetherai_output(data) do
    %{
      "message" => %{
        "role" => "assistant",
        "content" => JSON.encode!(data)
      }
    }
  end

  defp get_gemini_output(data) do
    %{
      "content" => %{
        "parts" => [%{"text" => JSON.encode!(data)}]
      }
    }
  end

  defp get_openrouter_output(data) do
    %{
      "message" => %{
        "role" => "assistant",
        "content" => JSON.encode!(data)
      }
    }
  end
end
