struct EmailVerificationCode {
  static let length = 6

  var text = ""
  private var rejectedCode: String?

  var normalized: String {
    text.filter(TextEdit.isDigit)
  }

  var canSubmit: Bool {
    normalized.count == Self.length && !isRejected
  }

  private var isRejected: Bool {
    normalized == rejectedCode
  }

  mutating func recordFailure(_ failure: AccountFailure?, for submittedCode: String) {
    if failure == .invalidCode {
      rejectedCode = submittedCode
    }
  }

  func displayedFailure(_ failure: AccountFailure?) -> AccountFailure? {
    switch failure {
    case nil, .invalidCode:
      isRejected ? .invalidCode : nil
    default:
      failure
    }
  }
}
