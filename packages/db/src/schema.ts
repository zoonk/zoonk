import schema from "./generated/metadata/schema.json" with { type: "json" };

export const databaseSchema = schema;
export type DatabaseModel = (typeof databaseSchema.models)[number];
export type DatabaseField = DatabaseModel["fields"][number];
