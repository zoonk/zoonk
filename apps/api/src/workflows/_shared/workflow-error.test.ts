import { describe, expect, test } from "vitest";
import { serializeWorkflowError } from "./workflow-error";

describe(serializeWorkflowError, () => {
  test("preserves Error details", () => {
    const error = new TypeError("AI provider failed");

    expect(serializeWorkflowError(error)).toEqual({
      message: "AI provider failed",
      name: "TypeError",
      stack: expect.any(String),
    });
  });

  test("preserves message fields from plain provider errors", () => {
    expect(
      serializeWorkflowError({
        message: "Rate limit exceeded",
        name: "AI_RetryError",
        stack: "stack trace",
      }),
    ).toEqual({
      message: "Rate limit exceeded",
      name: "AI_RetryError",
      stack: "stack trace",
    });
  });

  test("serializes unusual thrown values without throwing", () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;

    expect(serializeWorkflowError(circular)).toEqual({
      message: "[object Object]",
      name: "Error",
    });
  });

  test("preserves every nested AggregateError failure", () => {
    const error = new AggregateError(
      [new Error("course update failed"), new Error("suggestion update failed")],
      "Course status updates failed",
    );

    expect(serializeWorkflowError(error)).toEqual({
      errors: [
        expect.objectContaining({ message: "course update failed", name: "Error" }),
        expect.objectContaining({ message: "suggestion update failed", name: "Error" }),
      ],
      message: "Course status updates failed",
      name: "AggregateError",
      stack: expect.any(String),
    });
  });

  test("serializes circular nested errors without recursing forever", () => {
    const error = new AggregateError([], "Course status updates failed");
    error.errors.push(error);

    expect(serializeWorkflowError(error)).toEqual({
      errors: [
        {
          message: "Circular error reference",
          name: "Error",
        },
      ],
      message: "Course status updates failed",
      name: "AggregateError",
      stack: expect.any(String),
    });
  });
});
