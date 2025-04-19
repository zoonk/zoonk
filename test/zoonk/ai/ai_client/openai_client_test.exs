defmodule Zoonk.AI.AIClient.OpenAIClientTest do
  use Zoonk.DataCase, async: true

  alias Zoonk.AI.AIClient.OpenAIClient

  describe "generate_object/1" do
    test "returns the object when successful" do
      Req.Test.stub(Zoonk.AI.AIClient.OpenAIClient, fn conn ->
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

      assert {:ok, %{language: "English"}} = OpenAIClient.generate_object(%Zoonk.AI{})
    end
  end
end
