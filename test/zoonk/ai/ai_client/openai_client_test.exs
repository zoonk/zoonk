defmodule Zoonk.AI.AIClient.OpenAIClientTest do
  use Zoonk.DataCase, async: true

  alias Zoonk.AI.AIClient.OpenAIClient

  describe "generate_object/1" do
    test "returns the object when successful" do
      mock_response(~s({"language":"English"}))
      assert {:ok, %{language: "English"}} = OpenAIClient.generate_object(%Zoonk.AI{})
    end
  end

  defp mock_response(mock_data) do
    Req.Test.stub(:openai_client, fn conn ->
      Req.Test.json(conn, %{
        "error" => nil,
        "output" => [
          %{
            "content" => [
              %{"type" => "output_text", "text" => mock_data}
            ]
          }
        ]
      })
    end)
  end
end
