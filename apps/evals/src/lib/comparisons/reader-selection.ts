import { type Reader, readerSchema } from "./schemas";

const DEFAULT_THIRD_READER = "google/gemini-4-neon";
const BASE_FAMILIES = ["anthropic", "openai"];

export function modelReader(channel: string | undefined, model: string | undefined) {
  if (!model || !/^[\w-]+\/[\w.-]+$/u.test(model) || channel === "owner") {
    throw new Error("Specify a model reader as seat:provider/model or gateway:provider/model.");
  }

  const reader = readerSchema.parse({ channel, family: model.split("/")[0], model });

  if (reader.channel === "seat" && reader.family !== "anthropic") {
    throw new Error("Seat reads require a Claude model. Use gateway for other families.");
  }

  return reader;
}

function rivals(challenger: string, incumbent?: string) {
  return new Set([challenger.split("/")[0], incumbent?.split("/")[0]]);
}

function requiresThird(families: ReturnType<typeof rivals>) {
  return BASE_FAMILIES.every((family) => families.has(family));
}

function modelReaders(readers: Reader[]) {
  return readers.filter((reader) => reader.channel !== "owner");
}

export function additionalReaders(readers: Reader[]) {
  return modelReaders(readers).filter((reader) => !BASE_FAMILIES.includes(reader.family));
}

export function assertReaderPlan({
  challenger,
  incumbent,
  readers,
}: {
  challenger: string;
  incumbent?: string;
  readers: Reader[];
}) {
  const models = modelReaders(readers);

  if (models.some((reader) => modelReader(reader.channel, reader.model).family !== reader.family)) {
    throw new Error("A reader's family must match its model provider.");
  }

  if (new Set(models.map((reader) => reader.family)).size !== models.length) {
    throw new Error("Specify one reader per model family.");
  }

  if (
    !BASE_FAMILIES.every((family) =>
      models.some((reader) => reader.family === family && !reader.reserve),
    )
  ) {
    throw new Error("Include Claude and GPT as required readers.");
  }

  const families = rivals(challenger, incumbent);
  const extra = additionalReaders(models);

  if (extra.length > 1 || extra.some((reader) => families.has(reader.family))) {
    throw new Error("Choose one additional reader from a different family than either rival.");
  }

  if (requiresThird(families) ? !extra[0] || extra[0].reserve : extra[0] && !extra[0].reserve) {
    throw new Error(
      "Claude–GPT comparisons require a third reader on every pair. In other comparisons it is a reserve. Start a new comparison to change the reader plan.",
    );
  }
}

export function freezeReaders({
  challenger,
  incumbent,
  requested,
  reserve,
}: {
  challenger: string;
  incumbent?: string;
  requested: Reader[];
  reserve?: string;
}) {
  const families = rivals(challenger, incumbent);
  const required = requiresThird(families);
  const extra = additionalReaders(requested);
  const override = reserve && reserve !== "none" ? modelReader("gateway", reserve) : undefined;

  if (extra.length > 1 || (override && extra[0] && extra[0].model !== override.model)) {
    throw new Error("Choose one additional reader with --reader or --reserve.");
  }

  if (override && (BASE_FAMILIES.includes(override.family) || families.has(override.family))) {
    throw new Error(
      "Choose an additional reader from a different family than either rival or base reader.",
    );
  }

  if (!required && reserve === "none" && extra[0]) {
    throw new Error("--reserve none conflicts with the additional --reader.");
  }

  const defaultReader = modelReader("gateway", DEFAULT_THIRD_READER);

  const third =
    extra[0] ??
    override ??
    ((required || reserve !== "none") && !families.has(defaultReader.family)
      ? defaultReader
      : undefined);

  const readers = [
    ...requested.filter((reader) => !extra.includes(reader)),
    ...(third ? [{ ...third, reserve: !required }] : []),
  ];

  assertReaderPlan({ challenger, incumbent, readers });
  return readers;
}
