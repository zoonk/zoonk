struct EmailVerificationCode {
  var text = ""
  private var rejectedCode: String?

  var normalized: String {
    text.filter(\.isNumber)
  }

  var canSubmit: Bool {
    normalized.count == 6 && !isRejected
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
