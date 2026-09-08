import XMLBuilder from "fast-xml-builder";
import { XMLParser } from "fast-xml-parser";

const OPTIONS = {
  attributeNamePrefix: "",
  cdataPropName: "#cdata",
  commentPropName: "#comment",
  ignoreAttributes: false,
  parseTagValue: false,
  preserveOrder: true,
  trimValues: false,
};

function isElement(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTranslatable(element: unknown) {
  if (!isElement(element)) {
    return true;
  }

  const attributes = element[":@"];
  return !isElement(attributes) || attributes.translatable !== "false";
}

function omitNonTranslatable(element: unknown) {
  if (!isElement(element) || !Array.isArray(element.resources)) {
    return element;
  }

  const resources: unknown[] = element.resources;
  return { ...element, resources: resources.filter((resource) => isTranslatable(resource)) };
}

/** Preserve source attributes for the codec without duplicating Android's fallback-only resources. */
export function translationTemplate(source: string) {
  const document: unknown = new XMLParser(OPTIONS).parse(source);

  if (!Array.isArray(document)) {
    throw new TypeError("Expected Android resource XML");
  }

  const elements: unknown[] = document;
  return new XMLBuilder(OPTIONS).build(elements.map((element) => omitNonTranslatable(element)));
}
