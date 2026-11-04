import SwiftUI
import UIKit

/// Main's type roles: Geist for words and Geist Mono for data, at the sizes, weights and tracking
/// main measures at 390pt. App text takes a role with `typeStyle(_:)` instead of `font(_:)`;
/// system UI (bars, alerts, menus, pickers, the keyboard) keeps the system font.
///
/// Weights are Geist's named ones, as SwiftUI builds them with `Font.custom`: on iOS a weight
/// change inside a text (Markdown's bold, `typeWeight(_:legibility:)`) can't move a font pinned
/// between them, so main's 550 to 640 take the nearest.
struct TypeStyle: Hashable, Sendable {
  enum Face: Hashable, Sendable {
    case sans
    case mono
  }

  /// In points at the default text size, as main's px.
  var size: Double
  /// The text style whose Dynamic Type growth this size follows.
  var relativeTo: Font.TextStyle
  var weight: Font.Weight
  /// In em, as main's `letter-spacing`; main's body sets −0.006em under every role without its own.
  var tracking = -0.006
  var face = Face.sans
  var isTabular = false
  var isItalic = false
  var isUppercase = false
}

extension TypeStyle {
  /// Main's `text-headline`: a course's, chapter's or lesson's name on its page, a ceremony.
  static let heroTitle = TypeStyle(
    size: 34, relativeTo: .largeTitle, weight: .semibold, tracking: -0.035)
  /// Main's `text-title`.
  static let pageTitle = TypeStyle(
    size: 30, relativeTo: .title, weight: .semibold, tracking: -0.035)
  /// Main's `text-section`.
  static let section = TypeStyle(size: 20, relativeTo: .title3, weight: .semibold, tracking: -0.02)
  /// A lesson's question.
  static let question = TypeStyle(
    size: 19, relativeTo: .title3, weight: .semibold, tracking: -0.02)
  /// A lesson's running text.
  static let lessonText = TypeStyle(size: 18, relativeTo: .body, weight: .regular)
  /// Main's `text-lead`, in the secondary color.
  static let lead = TypeStyle(size: 17, relativeTo: .body, weight: .regular, tracking: -0.01)
  /// Running text read for itself: the buddy's words, a question's context, Today's queue.
  static let reading = TypeStyle(size: 16, relativeTo: .callout, weight: .regular)
  /// A screen's action.
  static let button = TypeStyle(size: 15, relativeTo: .subheadline, weight: .medium)
  /// Text in the app; text without a role takes it.
  static let body = TypeStyle(size: 14, relativeTo: .subheadline, weight: .regular)
  static let rowTitle = TypeStyle(size: 14, relativeTo: .subheadline, weight: .medium)
  /// Main's `PageSectionTitle`: a page's block, in the primary color.
  static let sectionTitle = TypeStyle(
    size: 14, relativeTo: .subheadline, weight: .semibold, tracking: -0.01)
  /// A button beside text, main's `size="sm"`.
  static let smallButton = TypeStyle(size: 13, relativeTo: .footnote, weight: .medium)
  /// A note under a block, a hint.
  static let note = TypeStyle(size: 13, relativeTo: .footnote, weight: .regular)
  /// A row's description, in the secondary color.
  static let meta = TypeStyle(size: 12, relativeTo: .caption, weight: .regular)
  /// Minutes, counts, dates and a row's trailing value.
  static let data = meta.monospaced()
  /// Over a page's title, in the secondary color.
  static let eyebrow = TypeStyle(
    size: 11.5, relativeTo: .caption2, weight: .regular, face: .mono, isUppercase: true)
  /// Uppercase, inside a panel only.
  static let label = TypeStyle(
    size: 11.5, relativeTo: .caption2, weight: .medium, tracking: 0.04, isUppercase: true)
  /// A chip's word, main's `CHIP_CLASS`.
  static let chip = TypeStyle(size: 11.5, relativeTo: .caption2, weight: .medium)
  /// Plot labels and marks too small for `meta`.
  static let small = TypeStyle(size: 11, relativeTo: .caption2, weight: .regular)
  /// A block's one big number, its unit beside it in `.body` and the secondary color.
  static let readout = TypeStyle(
    size: 24, relativeTo: .title2, weight: .semibold, tracking: -0.04, isTabular: true)
  /// The number a moment or a result leads with.
  static let momentReadout = TypeStyle(
    size: 40, relativeTo: .largeTitle, weight: .semibold, tracking: -0.04, isTabular: true)

  func weight(_ weight: Font.Weight) -> TypeStyle {
    var style = self
    style.weight = weight
    return style
  }

  func bold() -> TypeStyle {
    weight(.bold)
  }

  /// Geist Mono, whose figures are all one width.
  func monospaced() -> TypeStyle {
    var style = self
    style.face = .mono
    return style
  }

  /// Geist with tabular figures.
  func monospacedDigit() -> TypeStyle {
    var style = self
    style.isTabular = true
    return style
  }

  func italic() -> TypeStyle {
    var style = self
    style.isItalic = true
    return style
  }

  /// For a font inside an `AttributedString`, which can't read the environment: it grows with
  /// Dynamic Type, but Bold Text doesn't add to it.
  var attributeFont: Font {
    styled(.custom(family, size: size, relativeTo: relativeTo), weight: weight)
  }

  /// For text that can't take `typeStyle(_:)`, such as text a `Canvas` resolves.
  func font(in environment: EnvironmentValues) -> Font {
    font(
      pointSize: pointSize(environment.dynamicTypeSize), legibility: environment.legibilityWeight)
  }

  fileprivate func pointSize(_ dynamicTypeSize: DynamicTypeSize) -> Double {
    UIFontMetrics(forTextStyle: relativeTo.uiTextStyle).scaledValue(
      for: size,
      compatibleWith: UITraitCollection(
        preferredContentSizeCategory: UIContentSizeCategory(dynamicTypeSize)))
  }

  /// SwiftUI doesn't add weight to a custom font for Bold Text, so this adds what iOS adds to the
  /// system font: two steps, regular reading as semibold.
  fileprivate func font(pointSize: Double, legibility: LegibilityWeight?) -> Font {
    styled(
      .custom(family, fixedSize: pointSize),
      weight: legibility == .bold ? weight.withBoldText : weight)
  }

  private var family: String {
    face == .mono ? "Geist Mono" : "Geist"
  }

  private func styled(_ font: Font, weight: Font.Weight) -> Font {
    let font = font.weight(weight)
    let italic = isItalic ? font.italic() : font
    return isTabular && face == .sans ? italic.monospacedDigit() : italic
  }
}

extension View {
  /// Sets the type role of the text in this view, as `font(_:)` sets a font.
  func typeStyle(_ style: TypeStyle) -> some View {
    modifier(TypeStyleModifier(style: style))
  }

  /// Sets the weight of this view's text in the role it inherits, so Bold Text still adds to it.
  func typeWeight(_ weight: Font.Weight) -> some View {
    modifier(TypeWeightModifier(weight: weight))
  }
}

extension Text {
  /// `typeWeight(_:)` for a piece of an interpolated `Text`, which can't read Bold Text itself: its
  /// view passes `legibilityWeight`, so the piece stays heavier than the bolder text around it.
  func typeWeight(_ weight: Font.Weight, legibility: LegibilityWeight?) -> Text {
    fontWeight(legibility == .bold ? weight.withBoldText : weight)
  }

  /// `Text(_:)` for Markdown in a type role. SwiftUI draws strong emphasis as the font's bold face,
  /// and Geist from semibold up already counts as bold, as regular text does under Bold Text; so
  /// each strong run takes `typeWeight(.bold, legibility:)` instead.
  init(_ text: AttributedString, legibility: LegibilityWeight?) {
    let runs = text.runs[\.inlinePresentationIntent]

    guard runs.contains(where: { $0.0?.contains(.stronglyEmphasized) == true }) else {
      self.init(text)
      return
    }

    var pieces = LocalizedStringKey.StringInterpolation(
      literalCapacity: 0, interpolationCount: runs.count)

    for (intent, range) in runs {
      var piece = AttributedString(text[range])

      if let intent, intent.contains(.stronglyEmphasized) {
        piece.inlinePresentationIntent = intent.subtracting(.stronglyEmphasized)
        pieces.appendInterpolation(Text(piece).typeWeight(.bold, legibility: legibility))
      } else {
        pieces.appendInterpolation(Text(piece))
      }
    }

    self.init(LocalizedStringKey(stringInterpolation: pieces))
  }
}

extension EnvironmentValues {
  @Entry fileprivate var typeStyle = TypeStyle.body
}

private struct TypeStyleModifier: ViewModifier {
  let style: TypeStyle

  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.legibilityWeight) private var legibilityWeight
  @Environment(\.textCase) private var textCase

  func body(content: Content) -> some View {
    let pointSize = style.pointSize(dynamicTypeSize)

    content
      .font(style.font(pointSize: pointSize, legibility: legibilityWeight))
      .tracking(style.tracking * pointSize)
      .textCase(style.isUppercase ? .uppercase : textCase)
      .environment(\.typeStyle, style)
  }
}

private struct TypeWeightModifier: ViewModifier {
  let weight: Font.Weight

  @Environment(\.typeStyle) private var style

  func body(content: Content) -> some View {
    content.typeStyle(style.weight(weight))
  }
}

extension Font.Weight {
  fileprivate var withBoldText: Font.Weight {
    let weights: [Font.Weight] = [
      .ultraLight, .thin, .light, .regular, .medium, .semibold, .bold, .heavy, .black,
    ]

    guard let index = weights.firstIndex(of: self) else {
      return self
    }

    return weights[min(index + 2, weights.count - 1)]
  }
}

extension Font.TextStyle {
  fileprivate var uiTextStyle: UIFont.TextStyle {
    switch self {
    case .largeTitle: .largeTitle
    case .title: .title1
    case .title2: .title2
    case .title3: .title3
    case .headline: .headline
    case .subheadline: .subheadline
    case .callout: .callout
    case .footnote: .footnote
    case .caption: .caption1
    case .caption2: .caption2
    default: .body
    }
  }
}
