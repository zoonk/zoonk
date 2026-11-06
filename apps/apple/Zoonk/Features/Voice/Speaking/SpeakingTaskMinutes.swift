import Foundation

func speakingTaskMinutes(min: Double, max: Double) -> String {
  min == max
    ? String(localized: "\(Int(min)) min", table: "Voice", comment: "A task's length")
    : String(
      localized: "\(Int(min))–\(Int(max)) min", table: "Voice", comment: "A task's length range")
}
