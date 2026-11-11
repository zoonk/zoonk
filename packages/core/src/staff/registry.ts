import { type DatabaseModel, databaseSchema } from "@zoonk/db/schema";
import { staffCredentialPolicy } from "./policy";

export const readableModels = databaseSchema.models.filter(
  (model) => !staffCredentialPolicy.excludedModels.includes(model.name),
);

export function readableFields(model: DatabaseModel) {
  return model.fields.filter(
    (field) =>
      field.kind !== "object" &&
      !staffCredentialPolicy.strippedFields[model.name]?.includes(field.name),
  );
}

export function getEnumValues(type: string) {
  return databaseSchema.enums.find((entry) => entry.name === type)?.values ?? [];
}

export function describeModels() {
  return readableModels.map((model) => ({
    fields: readableFields(model).map((field) => ({
      isList: field.isList,
      isOptional: !field.isRequired,
      name: field.name,
      type: field.type,
      ...(field.kind === "enum" ? { values: getEnumValues(field.type) } : {}),
    })),
    name: model.name,
  }));
}
