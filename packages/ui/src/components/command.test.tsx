import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { Command, CommandInput } from "./command";

describe("CommandInput", () => {
  /**
   * iOS Safari automatically zooms in when focusing on input fields
   * with font-size smaller than 16px. The `text-base` class (16px)
   * prevents this behavior on mobile devices.
   */
  test("has text-base class to prevent iOS Safari zoom on focus", () => {
    const placeholder = "Search...";

    render(
      <Command>
        <CommandInput placeholder={placeholder} />
      </Command>,
    );

    const input = screen.getByPlaceholderText(placeholder);
    expect(input).toHaveClass("text-base");
  });
});
