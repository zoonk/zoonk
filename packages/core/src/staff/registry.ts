import { type DatabaseModel, databaseSchema } from "@zoonk/db/schema";
import { FIXABLE_MODELS } from "./content-fixes/handlers/registry";
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

function describeFixes(modelName: string) {
  const fixable = FIXABLE_MODELS.get(modelName);
  return fixable ? { fixable } : {};
}

export function describeModels() {
  return readableModels.map((model) => ({
    ...describeFixes(model.name),
    fields: readableFields(model).map((field) => ({
      isList: field.isList,
      isOptional: !field.isRequired,
      name: field.name,
      type: field.type,
      ...(field.kind === "enum" ? { values: getEnumValues(field.type) } : {}),
    })),
    name: model.name,
    relations: model.fields
      .filter(
        (field) =>
          field.kind === "object" && !staffCredentialPolicy.excludedModels.includes(field.type),
      )
      .map((field) => field.name),
  }));
}
