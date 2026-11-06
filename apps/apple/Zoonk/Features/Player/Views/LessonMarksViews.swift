import SwiftUI

/// Without an example frame to sit on, the screen's icon sits on the corner of its title and text
/// together, so this draws both.
struct LessonScreenText: View {
  let title: String?
  let text: String
  let marks: StepMarks?

  var body: some View {
    let parts = marks.map { LessonTextParts(text, marks: $0) }
    let cornerIcon = parts?.example == nil ? marks?.icon : nil

    VStack(alignment: .leading, spacing: 20) {
      if let title {
        LessonQuestionText(text: title)
          .besideCornerIcon(cornerIcon)

        screenText(parts)
      } else {
        screenText(parts)
          .besideCornerIcon(cornerIcon)
      }
    }
  }

  @ViewBuilder
  private func screenText(_ parts: LessonTextParts?) -> some View {
    if let parts {
      LessonMarkedText(parts: parts, icon: marks?.icon)
    } else {
      LessonTextBlocks(text)
    }
  }
}

/// Main wraps the lines beside its floated icon, which SwiftUI can't. Here what leads the block keeps
/// clear of the icon for its whole height, and what follows starts below the icon, which may reach
/// into the space between them.
private struct BesideCornerIcon: ViewModifier {
  let icon: LessonIcon

  func body(content: Content) -> some View {
    VStack(alignment: .leading, spacing: 20) { content }
      .padding(.trailing, LessonCornerIcon.size + 12)
      .frame(maxWidth: .infinity, minHeight: LessonCornerIcon.size - 12, alignment: .topLeading)
      .overlay(alignment: .topTrailing) {
        LessonIconImage(icon: icon, size: LessonCornerIcon.size)
      }
  }
}

extension View {
  @ViewBuilder
  fileprivate func besideCornerIcon(_ icon: LessonIcon?) -> some View {
    if let icon {
      modifier(BesideCornerIcon(icon: icon))
    } else {
      self
    }
  }
}

private struct LessonMarkedText: View {
  let parts: LessonTextParts
  let icon: LessonIcon?

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      if let before = parts.before {
        blocks(before)
      }

      if let example = parts.example {
        LessonExampleFrame(icon: icon) {
          blocks(example)
        }
      }

      if let after = parts.after {
        blocks(after)
      }
    }
  }

  private func blocks(_ part: LessonTextParts.Part) -> some View {
    LessonTextBlocks(part.text, underline: part.underline)
  }
}

private struct LessonExampleFrame<Content: View>: View {
  @Environment(\.colorSchemeContrast) private var contrast
  /// Half the label's height, so it sits across the frame's top edge.
  @ScaledMetric(relativeTo: .footnote) private var labelRise: CGFloat = 9

  let icon: LessonIcon?
  @ViewBuilder let content: Content

  private static var shape: UnevenRoundedRectangle {
    UnevenRoundedRectangle(
      topLeadingRadius: 20, bottomLeadingRadius: 10, bottomTrailingRadius: 22,
      topTrailingRadius: 12, style: .continuous)
  }

  var body: some View {
    content
      .padding(EdgeInsets(top: labelRise + 13, leading: 16, bottom: 16, trailing: 16))
      .frame(maxWidth: .infinity, alignment: .leading)
      .background {
        Self.shape
          .stroke(
            contrast == .increased ? Color(.foreground) : .mutedForeground,
            style: StrokeStyle(lineWidth: 1.5, dash: [5, 4])
          )
          .rotationEffect(.degrees(-0.6))
      }
      .overlay(alignment: .topLeading) {
        Text(
          "Example", tableName: "Player",
          comment: "Label on the frame around a lesson screen's example sentences"
        )
        .typeStyle(.note.weight(.medium))
        .foregroundStyle(.mutedForeground)
        .padding(.horizontal, 6)
        .background(Color(.systemBackground))
        .alignmentGuide(.top) { $0.height / 2 }
        .padding(.leading, 12)
      }
      .lessonCornerIcon(icon, inset: labelRise + 11)
      .padding(.top, labelRise)
  }
}

/// A lesson's icon sits on a block's top trailing corner, mostly above it, and leave its text alone:
/// their bottom stops `inset` into the block, above its first line. The block makes room above for
/// them, so they cover nothing before it either.
private struct LessonCornerIcon: ViewModifier {
  static let size: CGFloat = 56

  let icon: LessonIcon
  let inset: CGFloat

  func body(content: Content) -> some View {
    content
      .overlay(alignment: .topTrailing) {
        LessonIconImage(icon: icon, size: Self.size)
          .alignmentGuide(.top) { $0[.bottom] - inset }
          .alignmentGuide(.trailing) { $0[.trailing] - $0.width * 0.2 }
      }
      .padding(.top, Self.size - inset)
  }
}

extension View {
  @ViewBuilder
  fileprivate func lessonCornerIcon(_ icon: LessonIcon?, inset: CGFloat) -> some View {
    if let icon {
      modifier(LessonCornerIcon(icon: icon, inset: inset))
    } else {
      self
    }
  }
}

/// An icon from the lesson's library, loaded like its pictures. It's decorative: until it loads, or
/// if it never does, its place stays empty and nothing moves.
struct LessonIconImage: View {
  @Environment(\.displayScale) private var displayScale

  let icon: LessonIcon
  let size: CGFloat

  var body: some View {
    AsyncImage(url: URL(string: size * displayScale <= 96 ? icon.smallUrl : icon.url)) { phase in
      phase.image?
        .resizable()
        .scaledToFit()
    }
    .frame(width: size, height: size)
    .accessibilityHidden(true)
  }
}

/// Lousa's dotted paper behind a knowledge lesson's reading screens and its map. A question keeps a
/// plain page, which reads as the learner's turn. More contrast keeps every page plain.
struct LessonPaper: View {
  @Environment(\.colorSchemeContrast) private var contrast

  var body: some View {
    if contrast == .standard {
      Canvas { context, size in
        let spacing: CGFloat = 20
        let radius: CGFloat = 1.1
        var dots = Path()

        for x in stride(from: spacing / 2, through: size.width, by: spacing) {
          for y in stride(from: spacing / 2, through: size.height, by: spacing) {
            dots.addEllipse(
              in: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2))
          }
        }

        context.fill(dots, with: .color(.primary.opacity(0.1)))
      }
      .ignoresSafeArea()
      .accessibilityHidden(true)
    }
  }
}
