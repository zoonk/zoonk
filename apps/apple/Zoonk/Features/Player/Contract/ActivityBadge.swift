import SwiftUI

/// Main's `ActivityBadge`: what the learner does in an activity, named above its prompt.
enum ActivityBadge: Sendable {
  /// A template's badge, or the one its fields call for.
  enum Rule: Sendable {
    case always(ActivityBadge)
    case by(@Sendable (ActivityStepContent) -> ActivityBadge)

    func badge(for content: ActivityStepContent) -> ActivityBadge {
      switch self {
      case .always(let badge): badge
      case .by(let rule): rule(content)
      }
    }
  }

  case beforeAfter
  case buildArgument
  case buildIt
  case compareSources
  case dragCorner
  case earTraining
  case estimateFirst
  case explore
  case exploreMap
  case fillSquare
  case findError
  case followQuestions
  case handsOn
  case labelIt
  case linkCauses
  case matchPairs
  case moveCurve
  case placeInTime
  case placeIt
  case playIt
  case predictFirst
  case putInOrder
  case queryData
  case readAndListen
  case readChart
  case reply
  case runCode
  case simulate
  case sortGroups
  case splitIt
  case spotPattern
  case stepByStep
  case stepThrough
  case tapAlong
  case testPattern
  case tryIt
  case turnIt

  var title: LocalizedStringResource {
    switch self {
    case .beforeAfter:
      LocalizedStringResource(
        "Before and after", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .buildArgument:
      LocalizedStringResource(
        "Build an argument", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .buildIt:
      LocalizedStringResource(
        "Build it", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .compareSources:
      LocalizedStringResource(
        "Compare sources", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .dragCorner:
      LocalizedStringResource(
        "Drag a corner", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .earTraining:
      LocalizedStringResource(
        "Ear training", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .estimateFirst:
      LocalizedStringResource(
        "Estimate first", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .explore:
      LocalizedStringResource(
        "Explore", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .exploreMap:
      LocalizedStringResource(
        "Explore the map", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .fillSquare:
      LocalizedStringResource(
        "Fill the square", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .findError:
      LocalizedStringResource(
        "Find the error", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .followQuestions:
      LocalizedStringResource(
        "Follow the questions", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .handsOn:
      LocalizedStringResource(
        "Hands on", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .labelIt:
      LocalizedStringResource(
        "Label it", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .linkCauses:
      LocalizedStringResource(
        "Link causes", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .matchPairs:
      LocalizedStringResource(
        "Match pairs", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .moveCurve:
      LocalizedStringResource(
        "Move a curve", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .placeInTime:
      LocalizedStringResource(
        "Place in time", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .placeIt:
      LocalizedStringResource(
        "Place it", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .playIt:
      LocalizedStringResource(
        "Play it", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .predictFirst:
      LocalizedStringResource(
        "Predict first", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .putInOrder:
      LocalizedStringResource(
        "Put in order", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .queryData:
      LocalizedStringResource(
        "Query the data", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .readAndListen:
      LocalizedStringResource(
        "Read and listen", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .readChart:
      LocalizedStringResource(
        "Read the chart", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .reply:
      LocalizedStringResource(
        "Reply", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .runCode:
      LocalizedStringResource(
        "Run the code", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .simulate:
      LocalizedStringResource(
        "Simulate", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .sortGroups:
      LocalizedStringResource(
        "Sort into groups", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .splitIt:
      LocalizedStringResource(
        "Split it", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .spotPattern:
      LocalizedStringResource(
        "Spot the pattern", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .stepByStep:
      LocalizedStringResource(
        "Step by step", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .stepThrough:
      LocalizedStringResource(
        "Step through", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .tapAlong:
      LocalizedStringResource(
        "Tap along", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .testPattern:
      LocalizedStringResource(
        "Test a pattern", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .tryIt:
      LocalizedStringResource(
        "Try it", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .turnIt:
      LocalizedStringResource(
        "Turn it", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    }
  }

  var systemImage: String {
    switch self {
    case .beforeAfter: "arrow.left.arrow.right.square"
    case .buildArgument: "puzzlepiece"
    case .buildIt: "atom"
    case .compareSources: "rectangle.split.2x1"
    case .dragCorner: "arrow.up.and.down.and.arrow.left.and.right"
    case .earTraining: "ear"
    case .estimateFirst: "target"
    case .explore: "point.bottomleft.forward.to.point.topright.scurvepath"
    case .exploreMap: "mappin.and.ellipse"
    case .fillSquare: "checkmark.square"
    case .findError: "text.magnifyingglass"
    case .followQuestions: "arrow.triangle.branch"
    case .handsOn: "hand.raised"
    case .labelIt: "tag"
    case .linkCauses: "point.3.connected.trianglepath.dotted"
    case .matchPairs: "link"
    case .moveCurve: "arrow.left.arrow.right"
    case .placeInTime: "arrow.up.and.down"
    case .placeIt: "arrow.left.and.right"
    case .playIt: "pianokeys"
    case .predictFirst: "dice"
    case .putInOrder: "arrow.up.arrow.down"
    case .queryData: "cylinder.split.1x2"
    case .readAndListen: "music.note"
    case .readChart: "chart.xyaxis.line"
    case .reply: "bubble.left.and.bubble.right"
    case .runCode: "terminal"
    case .simulate: "repeat"
    case .sortGroups: "rectangle.3.group"
    case .splitIt: "square.grid.2x2"
    case .spotPattern: "tablecells"
    case .stepByStep: "list.number"
    case .stepThrough: "shoeprints.fill"
    case .tapAlong: "hand.tap"
    case .testPattern: "asterisk"
    case .tryIt: "slider.horizontal.3"
    case .turnIt: "rotate.right"
    }
  }
}
