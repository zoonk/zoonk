/** The provider prefix of a gateway model id, such as "openai" for "openai/gpt-6-sol". */
export function getModelFamily(model: string): string {
  return model.split("/")[0] ?? model;
}
