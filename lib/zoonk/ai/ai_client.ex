defmodule Zoonk.AI.AIClient do
  @moduledoc """
  Public client for generating AI content
  across various services.

  This module provides a unified interface for
  interacting with different AI services.

  It delegates requests to the appropriate service
  based on the model specified.
  """
  alias Zoonk.AI
  alias Zoonk.AI.AIClient.OpenAIClient

  def generate_object(%AI{model: "gpt-" <> _gpt} = payload) do
    OpenAIClient.generate_object(payload)
  end

  def generate_object(_payload) do
    {:error, "Unsupported model"}
  end
end
