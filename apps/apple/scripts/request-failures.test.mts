import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { screenFailuresIn } from "./request-owners.mts";

describe("request failure detection", () => {
  it.each(["didFail", "error", "startProblem", "moveProblem"])(
    "follows the request's %s",
    (name) => {
      const types: Record<string, string> = { didFail: "Bool", error: "GoalError?" };
      const type = types[name] ?? "LocalizedStringResource?";

      const source = `struct Card: View {
      @State private var ${name}: ${type}
      @State private var request: Task<Void, Never>?
      func start() { request = Task { await send() } }
      func send() async { do { try await write() } catch { ${name} = problem } }
    }`;

      assert.deepEqual(screenFailuresIn(source, "Card.swift"), ["Card.swift: Card"]);
    },
  );

  it("does not mistake another control's reset for a request failure", () => {
    const source = `struct Card: View {
      @State private var imageFailed = false
      @State private var request: Task<Void, Never>?
      func start() {
        request = Task {
          imageFailed = false
          do { try await write() } catch { report() }
        }
      }
    }`;

    assert.deepEqual(screenFailuresIn(source, "Card.swift"), []);
  });

  it("follows work supplied to a task-owning helper", () => {
    const source = `struct Card: View {
      @State private var moveProblem: LocalizedStringResource?
      @State private var action: Task<Void, Never>?
      func run(_ work: @escaping () async -> Void) { action = Task { await work() } }
      func tap() { run { await move() } }
      func move() async { switch await write() { case .failed: moveProblem = problem } }
    }`;

    assert.deepEqual(screenFailuresIn(source, "Card.swift"), ["Card.swift: Card"]);
  });

  it("reports a nested view once, without attributing its state to its parent", () => {
    const source = `struct Outer: View {
      struct Inner: View {
        @State private var failed = false
        @State private var saving: Task<Void, Never>?
        func save() { saving = Task { if case .failed = await write() { failed = true } } }
      }
    }`;

    assert.deepEqual(screenFailuresIn(source, "Card.swift"), ["Card.swift: Inner"]);
  });

  it("ignores an unrelated failure and braces or declarations in text", () => {
    const source = `struct Card: View {
      @State private var imageFailed = false
      @State private var request: Task<Void, Never>?
      func start() { request = Task { await write() } }
      func image() { imageFailed = true }
      var label = "} struct Fake { @State var failed: Bool; @State var task: Task<Void, Never>?"
    }`;

    assert.deepEqual(screenFailuresIn(source, "Card.swift"), []);
  });
});
