import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import generatorHelper from "@prisma/generator-helper";

generatorHelper.generatorHandler({
  async onGenerate({ dmmf, generator }) {
    const output = generator.output?.value;

    if (!output) {
      throw new Error("Schema metadata needs an output directory");
    }

    const models = dmmf.datamodel.models.map(({ name, fields, primaryKey }) => ({
      fields: fields.map(
        ({ name: fieldName, kind, type, isList, isRequired, isId, nativeType }) => ({
          isId,
          isList,
          isRequired,
          kind,
          name: fieldName,
          nativeType,
          type,
        }),
      ),
      name,
      primaryKey: primaryKey?.fields ?? [],
    }));

    const enums = dmmf.datamodel.enums.map(({ name, values }) => ({
      name,
      values: values.map((value) => value.name),
    }));

    await mkdir(output, { recursive: true });
    await writeFile(join(output, "schema.json"), `${JSON.stringify({ enums, models }, null, 2)}\n`);
  },
  onManifest: () => ({ defaultOutput: "../generated/metadata", prettyName: "schema metadata" }),
});
