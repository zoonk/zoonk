export function getModelFamily(model: string): string {
  return model.split("/")[0] ?? model;
}
