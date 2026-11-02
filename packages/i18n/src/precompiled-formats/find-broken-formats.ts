import {
  type MessageFormatElement,
  isDateElement,
  isNumberElement,
  isPluralElement,
  isSelectElement,
  isTagElement,
  isTimeElement,
  parse,
} from "@formatjs/icu-messageformat-parser";

function rendersWrong(element: MessageFormatElement): boolean {
  if (isTimeElement(element)) {
    return element.style === null || typeof element.style === "string";
  }

  return (isDateElement(element) || isNumberElement(element)) && typeof element.style === "string";
}

function findIn({
  elements,
  message,
}: {
  elements: MessageFormatElement[];
  message: string;
}): string[] {
  return elements.flatMap((element) => {
    if (isPluralElement(element) || isSelectElement(element)) {
      return Object.values(element.options).flatMap((option) =>
        findIn({ elements: option.value, message }),
      );
    }

    if (isTagElement(element)) {
      return findIn({ elements: element.children, message });
    }

    if (!rendersWrong(element) || !element.location) {
      return [];
    }

    return [message.slice(element.location.start.offset, element.location.end.offset)];
  });
}

/**
 * The arguments precompiled next-intl messages render wrong: `{x, time}` as a date, and any named
 * style, such as `{x, date, medium}` or `{x, number, percent}`, as if it had none, since we define no
 * `formats` (https://github.com/amannn/next-intl/issues/2447).
 */
export function findBrokenFormats(message: string): string[] {
  return findIn({ elements: parse(message, { captureLocation: true }), message });
}
