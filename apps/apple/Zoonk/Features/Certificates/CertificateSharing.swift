import CoreTransferable
import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// One of a certificate's pictures as a PNG file, downloaded only when the share sheet asks for
/// it.
struct CertificateFile: Transferable, Sendable {
  let url: URL
  let fileName: String

  static var transferRepresentation: some TransferRepresentation {
    DataRepresentation(exportedContentType: .png) { file in
      try await file.data()
    }
    .suggestedFileName { $0.fileName }
  }

  /// The pictures are public, so the shared URL cache serves one already downloaded.
  func data() async throws -> Data {
    let (data, response) = try await URLSession.shared.data(from: url)

    guard (response as? HTTPURLResponse)?.statusCode == 200 else {
      throw APIError.unavailable
    }

    return data
  }
}

extension Certificate {
  /// What a post shows: the post picture, with the suggested text and the link beside it.
  var post: CertificateFile {
    CertificateFile(url: pictures.post, fileName: fileName)
  }

  /// The certificate itself, for print and saving.
  var document: CertificateFile {
    CertificateFile(url: pictures.print, fileName: fileName)
  }

  /// "Ana Souza - Quantum physics from scratch - Zoonk", as main names the download. Files keep
  /// a name to 255 bytes, which a long title in Japanese or Korean passes, so it's cut to whole
  /// characters that fit with ".png".
  var fileName: String {
    let name = [facts.recipientName, facts.name, "Zoonk"].compactMap { $0 }
      .joined(separator: " - ")
      .replacingOccurrences(of: "/", with: "-")
      .replacingOccurrences(of: ":", with: "-")

    var fitting = ""

    for character in name {
      guard fitting.utf8.count + String(character).utf8.count <= 250 else {
        break
      }

      fitting.append(character)
    }

    return fitting
  }

  /// The suggested text, then the link, as one message.
  var shareMessage: String {
    "\(facts.suggestedText) \(url.absoluteString)"
  }
}

extension CertificateFacts {
  /// Main's suggested text for a post.
  var suggestedText: String {
    switch kind {
    case .course:
      let lessons = lessonsStudied ?? 0

      if lessons == 0 {
        return String(
          localized: "I just finished \(name) on Zoonk.",
          table: "Certificates",
          comment:
            "Suggested text for sharing a course certificate whose lessons were all passed by test: the course or its level, such as Python · Beginner"
        )
      }

      if let minutes, minutes > 0 {
        return String(
          localized:
            "I just finished \(name) on Zoonk: \(lessons) lessons and about \(studyTime(minutes)) of study.",
          table: "Certificates",
          comment:
            "Suggested text for sharing a course certificate: the course or its level (Python · Beginner), the lessons studied, then about how long they took, such as \"41 hours\""
        )
      }

      return String(
        localized: "I just finished \(name) on Zoonk: \(lessons) lessons.",
        table: "Certificates",
        comment:
          "Suggested text for sharing a course certificate: the course or its level (Python · Beginner), then the lessons studied"
      )
    case .languageLevel:
      return String(
        localized: "I just completed level \(level ?? "") in \(languageName) on Zoonk.",
        table: "Certificates",
        comment:
          "Suggested text for sharing a language level certificate: the level, then the language")
    }
  }
}

/// Main's `roundStudyMinutes`: the plan's estimate, so whole hours past the first one.
func roundStudyMinutes(_ minutes: Int) -> Int {
  minutes < 60 ? minutes : Int((Double(minutes) / 60).rounded()) * 60
}

/// "41 hours", or "45 minutes" under an hour, in a post's words.
func studyTime(_ minutes: Int) -> String {
  let rounded = roundStudyMinutes(minutes)
  let measurement =
    rounded < 60
    ? Measurement(value: Double(rounded), unit: UnitDuration.minutes)
    : Measurement(value: Double(rounded / 60), unit: UnitDuration.hours)

  return measurement.formatted(.measurement(width: .wide, usage: .asProvided))
}

@MainActor
enum CertificatePrinting {
  /// The system's print sheet, which also saves a PDF, pointing at `anchor` where it's a popover.
  /// The picture is A4 landscape and prints scaled to fit any paper.
  static func print(_ data: Data, jobName: String, from anchor: UIView?) {
    let info = UIPrintInfo.printInfo()
    info.jobName = jobName
    info.orientation = .landscape
    info.outputType = .general

    let controller = UIPrintInteractionController.shared
    controller.printInfo = info
    controller.printingItem = data

    if let anchor {
      controller.present(from: anchor.bounds, in: anchor, animated: true)
    } else {
      controller.present(animated: true)
    }
  }
}

/// The view the print popover points at.
@MainActor
final class PrintAnchor {
  weak var view: UIView?
}

struct PrintAnchorView: UIViewRepresentable {
  let anchor: PrintAnchor

  func makeUIView(context: Context) -> UIView {
    let view = UIView()
    view.isUserInteractionEnabled = false
    anchor.view = view
    return view
  }

  func updateUIView(_ view: UIView, context: Context) {
    anchor.view = view
  }
}
