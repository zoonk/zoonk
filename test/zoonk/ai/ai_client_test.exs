defmodule Zoonk.AI.AIClientTest do
  use Zoonk.DataCase, async: true

  alias Zoonk.AI
  alias Zoonk.AI.AIClient

  describe "generate_object/1" do
    test "delegates to OpenAIClient for gpt models" do
      Req.Test.stub(:openai_client, fn conn ->
        Req.Test.json(conn, %{
          "error" => nil,
          "output" => [
            %{
              "content" => [
                %{"type" => "output_text", "text" => ~s({"language":"English"})}
              ]
            }
          ]
        })
      end)

      payload = %AI{model: "gpt-4.1-mini"}
      assert {:ok, %{}} = AIClient.generate_object(payload)
    end
  end

  test "returns an error for unsupported models" do
    payload = %AI{model: "unsupported-model"}
    assert {:error, "Unsupported model"} = AIClient.generate_object(payload)
  end
end
