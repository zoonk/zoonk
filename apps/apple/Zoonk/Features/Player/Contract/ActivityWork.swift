import Observation
import SwiftUI

/// What the learner did on a screen's canvas beyond its answer: sliders moved, pieces placed, code
/// typed and run. The player keeps it exactly as long as the screen's answer, so a canvas made
/// again by a fold, a rotation, a resized window or Split View shows it as the learner left it,
/// Previous shows it with the result, and a screen whose answer starts over starts it over too.
@MainActor
@Observable
final class ActivityWork {
  private var values: [String: any Sendable] = [:]
  private let changed: () -> Void

  init(changed: @escaping () -> Void = {}) {
    self.changed = changed
  }

  func value<Value>(_ key: String) -> Value? {
    values[key] as? Value
  }

  func set<Value: Equatable & Sendable>(_ value: Value, for key: String) {
    guard values[key] as? Value != value else {
      return
    }

    values[key] = value
    changed()
  }
}

/// `@State` for a canvas's share of the learner's work, kept in the screen's `ActivityWork` under
/// `key` (unique within the canvas). Momentary things (a drag in progress, focus, a measured width,
/// a sound playing) stay `@State`.
@MainActor
@propertyWrapper
struct ActivityState<Value: Equatable & Sendable>: DynamicProperty {
  @Environment(ActivityWork.self) private var work
  /// What the canvas was first made with, as `@State` keeps it, until the learner changes it.
  @State private var initial: Value
  private let key: String

  init(wrappedValue: Value, _ key: String) {
    _initial = State(initialValue: wrappedValue)
    self.key = key
  }

  var wrappedValue: Value {
    get { work.value(key) ?? initial }
    nonmutating set { work.set(newValue, for: key) }
  }

  var projectedValue: Binding<Value> {
    let (work, key, initial) = (work, key, initial)

    return Binding {
      work.value(key) ?? initial
    } set: { value in
      work.set(value, for: key)
    }
  }
}
