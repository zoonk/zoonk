#if DEBUG
  import SwiftUI

  /// `ZOONK_DEBUG_GALLERY=1` opens every color role and shared piece in one scroll, the native side
  /// of main's `/design` and Android's `GalleryActivity`, to check light, dark, more contrast,
  /// accessibility sizes and right to left in a few screenshots. `=buttons`, `=lists` and the other
  /// section names open at that section.
  struct DebugComponentGallery: ViewModifier {
    /// Also a launch argument (`-ZOONK_DEBUG_GALLERY lists`), which device tools can pass.
    private let section =
      ProcessInfo.processInfo.environment["ZOONK_DEBUG_GALLERY"]
      ?? UserDefaults.standard.string(forKey: "ZOONK_DEBUG_GALLERY")

    func body(content: Content) -> some View {
      if let section {
        content.fullScreenCover(isPresented: .constant(true)) {
          NavigationStack {
            if let writing = DebugLessonWait.writing(section) {
              DebugLessonWait(writing: writing)
            } else {
              ComponentGallery(start: section)
            }
          }
          .zoonkStyles()
        }
      } else {
        content
      }
    }
  }

  private struct ComponentGallery: View {
    let start: String

    var body: some View {
      ScrollViewReader { proxy in
        ZoonkList {
          PageHeader(
            Text(verbatim: "Design system"), eyebrow: Text(verbatim: "Tue, Nov 3 · Debug"),
            supporting: Text(verbatim: "Every role and shared piece, as main's /design.")
          ) {
            Text(verbatim: "43 min")
              .typeStyle(.readout)
          }

          GallerySection(id: "colors", title: "Color roles") { ColorRoleSwatches() }
          GallerySection(id: "text", title: "Neutral text") { NeutralText() }
          GallerySection(id: "buttons", title: "Buttons") { Buttons() }
          GallerySection(id: "busy", title: "Busy, past the slow wait") { BusySamples() }
          GallerySection(id: "chips", title: "Chips and subjects") { Chips() }
          ListSample()
          GallerySection(id: "panels", title: "Panels and tiles") { Panels() }
          GallerySection(id: "meters", title: "Meters") { Meters() }
          GallerySection(id: "waits", title: "Waits") { Waits() }
          GallerySection(id: "marks", title: "Marks, kinds and belts") { Marks() }
          GallerySection(id: "options", title: "Answer options") { Options() }
          GallerySection(id: "fields", title: "Fields") { Fields() }
        }
        .navigationTitle(Text(verbatim: "Design system"))
        .barTitleAfterHero("Design system")
        .onAppear {
          proxy.scrollTo(start, anchor: .top)
        }
      }
    }
  }

  private struct GallerySection<Content: View>: View {
    let id: String
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
      Section {
        content
      } header: {
        SectionTitle(Text(verbatim: title)) {
          Text(verbatim: id)
        }
      }
      .id(id)
    }
  }

  private struct ColorRoleSwatches: View {
    private let roles: [(String, Color)] = [
      ("background", Color(.background)), ("card", .card), ("muted", .muted),
      ("surface-3", .surface3), ("border", .border), ("input", .input),
      ("foreground", Color(.foreground)), ("muted-fg", .mutedForeground), ("faint", .faint),
      ("primary", Color(.primary)), ("selected-tint", .selectedTint), ("success", .success),
      ("destructive", .destructive), ("warning", .warning), ("brain", .brain),
      ("energy", .energy), ("kind-review", LearnKind.review.color),
      ("kind-mock", LearnKind.mock.color), ("kind-conv", LearnKind.conversation.color),
      ("kind-map", LearnKind.mindMap.color), ("viz-accent", .vizAccent),
      ("viz-highlight", .vizHighlight), ("viz-secondary", .vizSecondary),
    ]

    var body: some View {
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 72), spacing: 8)], spacing: 8) {
        ForEach(roles, id: \.0) { name, color in
          VStack(spacing: 4) {
            RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
              .fill(color)
              .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous).strokeBorder(.border)
              )
              .frame(height: 36)
            Text(verbatim: name)
              .typeStyle(.small)
              .foregroundStyle(.mutedForeground)
              .lineLimit(1)
              .minimumScaleFactor(0.7)
          }
        }
      }
      .padding(.vertical, 8)
    }
  }

  private struct NeutralText: View {
    var body: some View {
      ForEach(
        [("background", Color(.background)), ("card", Color.card), ("muted", Color.muted)],
        id: \.0
      ) { name, surface in
        VStack(alignment: .leading, spacing: 2) {
          Text(verbatim: "Foreground on \(name)").foregroundStyle(Color(.foreground))
          Text(verbatim: "Muted foreground on \(name)").foregroundStyle(.mutedForeground)
          Text(verbatim: "Faint on \(name)").foregroundStyle(.faint)
          HStack(spacing: 12) {
            Text(verbatim: "Progress").foregroundStyle(.successText)
            Text(verbatim: "Wrong").foregroundStyle(.destructiveText)
            Text(verbatim: "Look here").foregroundStyle(.warningText)
            Text(verbatim: "Brain Power").foregroundStyle(.brainText)
          }
          .typeStyle(.note)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(surface, in: .rect(cornerRadius: Radius.lg))
      }
    }
  }

  private struct Buttons: View {
    var body: some View {
      VStack(alignment: .leading, spacing: 12) {
        Button {
        } label: {
          Text(verbatim: "Continue session").frame(maxWidth: .infinity)
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)

        Button {
        } label: {
          Text(verbatim: "I don't know yet").frame(maxWidth: .infinity)
        }
        .buttonStyle(.secondary)
        .controlSize(.large)

        ButtonRow {
          Button(String("Adjust plan")) {}.buttonStyle(.outline)
          Button(String("Not now")) {}.buttonStyle(.ghost)
          Button(String("Remove"), role: .destructive) {}.buttonStyle(.outline)
        }

        ButtonRow(spacing: 8) {
          Button(String("View")) {}.buttonStyle(.outline).controlSize(.small)
          Button(String("Save")) {}.buttonStyle(.mainAction).controlSize(.small)
          Button(String("Disabled")) {}.buttonStyle(.mainAction).controlSize(.small).disabled(true)
          Button(String("Off")) {}.buttonStyle(.outline).controlSize(.small).disabled(true)
        }

        ButtonRow(spacing: 8) {
          Button(String("Send"), systemImage: "arrow.up") {}
            .labelStyle(.iconOnly).buttonStyle(.mainAction.icon).controlSize(.small)
          Button(String("Ask"), systemImage: "questionmark.bubble") {}
            .labelStyle(.iconOnly).buttonStyle(.outline.icon)
        }

        Toggle(String("A switch"), isOn: .constant(true))
          .tint(.success)
      }
      .padding(.vertical, 8)
    }
  }

  private struct BusySamples: View {
    var body: some View {
      VStack(alignment: .leading, spacing: 12) {
        BusyButton(isBusy: true) {
        } label: {
          Text(verbatim: "Continue session").frame(maxWidth: .infinity)
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)

        BusyButton(isBusy: true) {
        } label: {
          Text(verbatim: "I don't know yet").frame(maxWidth: .infinity)
        }
        .buttonStyle(.secondary)
        .controlSize(.large)

        ButtonRow {
          BusyButton(isBusy: true) {
          } label: {
            Text(verbatim: "Adjust plan")
          }
          .buttonStyle(.outline)
          BusyButton(isBusy: true) {
          } label: {
            Text(verbatim: "Not now")
          }
          .buttonStyle(.ghost)
          BusyButton(isBusy: true, role: .destructive) {
          } label: {
            Text(verbatim: "Remove")
          }
          .buttonStyle(.outline)
        }

        ButtonRow(spacing: 8) {
          BusyButton(isBusy: true) {
          } label: {
            Label(String("Send"), systemImage: "arrow.up")
          }
          .labelStyle(.iconOnly).buttonStyle(.mainAction.icon).controlSize(.small)
          BusyButton(isBusy: true) {
          } label: {
            Label(String("Ask"), systemImage: "questionmark.bubble")
          }
          .labelStyle(.iconOnly).buttonStyle(.outline.icon)
        }
      }
      .padding(.vertical, 8)

      Button {
      } label: {
        ListRow(Text(verbatim: "Porcentagem e descontos")) {
          KindMark(kind: .lesson)
        } trailing: {
          Text(verbatim: "5 min").coveredBySpinnerWhenSlow(true, alignment: .trailing)
        }
      }
      .disabled(true)

      Button {
      } label: {
        Text(verbatim: "Show more").spinnerAtEndWhenSlow(true)
      }
      .disabled(true)
    }
  }

  private struct Fields: View {
    @State private var name = "Ana Souza"
    @State private var email = "ana@"
    @State private var message = ""

    var body: some View {
      FormField(title: Text(verbatim: "Name")) {
        TextField(String("Name"), text: $name)
      } hint: {
        Text(verbatim: "How Zoonk and your buddy call you")
      }

      FormField(title: Text(verbatim: "Email"), isInvalid: true) {
        TextField(String("Email"), text: $email)
      } hint: {
        Text(verbatim: "Enter a valid email address")
          .foregroundStyle(.destructiveText)
      }

      FormField(title: Text(verbatim: "Focused"), isFocused: true) {
        TextField(String("Focused"), text: $name)
      }

      FormField(title: Text(verbatim: "Message")) {
        MultilineTextField(
          text: $message, prompt: Text(verbatim: "What happened?"),
          label: Text(verbatim: "Message")
        )
        .lineLimit(3...5)
      }

      ForEach([false, true], id: \.self) { isFocused in
        HStack {
          Text(verbatim: isFocused ? "Speak Spanish for a job interview" : "I want to learn…")
            .foregroundStyle(isFocused ? Color(.foreground) : .faint)
            .frame(maxWidth: .infinity, alignment: .leading)
          Button(String("Build my plan")) {}.buttonStyle(.mainAction)
        }
        .padding(.leading, 16)
        .padding(6)
        .inputPanel(isFocused: isFocused)
      }
    }
  }

  private struct Chips: View {
    var body: some View {
      VStack(alignment: .leading, spacing: 8) {
        FlowLayout(spacing: 8) {
          Text(verbatim: "Plus").chip()
          Text(verbatim: "1 week").chip()
          ForEach(CourseCategory.allCases, id: \.self) { subject in
            CourseSubjectLabel(subject: subject)
          }
        }

        Text(verbatim: "A sentence in a chip, such as a lesson screen's eyebrow, takes more lines")
          .chip(wraps: true)
      }
      .padding(.vertical, 8)
    }
  }

  private struct ListSample: View {
    var body: some View {
      Section {
        ListRow(
          Text(verbatim: "Porcentagem e descontos"),
          description: Text(verbatim: "Matemática · often tested")
        ) {
          KindMark(kind: .lesson)
        } trailing: {
          Text(verbatim: "5 min")
        }
        .currentRow()

        ListRow(Text(verbatim: "Aumento seguido de desconto")) {
          KindMark(kind: .lesson)
        } trailing: {
          Text(verbatim: "5 min")
        }

        ListRow(Text(verbatim: "Practice mistakes")) {
          KindMark(kind: .mistakes)
        } trailing: {
          Text(verbatim: "3 min")
        }

        ListRow(Text(verbatim: "Juros compostos"), number: 3) {
        } trailing: {
          DisclosureChevron()
        }

        ListRow(Text(verbatim: "Unit 2 · Porcentagem")) {
        } trailing: {
          DisclosureChevron(pointsDown: true)
        }

        NavigationLink {
          Text(verbatim: "Memory")
        } label: {
          ListRow(Text(verbatim: "Memory"), description: Text(verbatim: "4 things Zu knows"))
        }

        Toggle(String("Daily reminder"), isOn: .constant(false))
          .tint(.success)
      } header: {
        SectionTitle(Text(verbatim: "Lists")) {
          Text(verbatim: "3 of 8")
        }
      } footer: {
        SectionFooter {
          Text(verbatim: "A note under the list, in muted foreground.")
        }
      }
      .id("lists")
    }
  }

  private struct Panels: View {
    var body: some View {
      GroupBox {
        Text(
          verbatim:
            "Você faz cursinho aos sábados de manhã. Quer que o sábado vire dia de descanso?"
        )
        .foregroundStyle(.mutedForeground)
        Button(String("View")) {}.buttonStyle(.outline).controlSize(.small)
      } label: {
        Label(String("A notice"), systemImage: "sparkle")
      }

      StatTileGrid(columns: [2, 1], minimumWidth: 140) {
        StatTile(
          label: Text(verbatim: "Preparation"), value: Text(verbatim: "16%"),
          systemImage: "chart.line.uptrend.xyaxis", tone: .success,
          detail: Text(verbatim: "No change this week"), meter: 0.16)
        StatTile(
          label: Text(verbatim: "Brain Power"), value: Text(verbatim: "1,240"),
          systemImage: "brain", tone: .brain)
      }

      ForEach(
        [
          ("Correct", FeedbackTone.right), ("Not graded", .neutral), ("Almost", .almost),
          ("Not quite", .wrong),
        ], id: \.0
      ) { title, tone in
        FeedbackVerdict(Text(verbatim: title), tone: tone) {
          Text(verbatim: "3 right in a row")
        }
        .feedbackPanel()
      }
    }
  }

  /// A run's wait at a few points, from events stamped as a real run's are, without running one.
  private struct Waits: View {
    var body: some View {
      VStack(alignment: .leading, spacing: 32) {
        GenerationTimeline(wait: DebugLessonWait.sample(reported: 3))
        GenerationTimeline(
          wait: DebugLessonWait.sample(reported: 1), failure: .generation, act: {})
        GenerationTimeline(
          wait: DebugLessonWait.sample(reported: 3), failure: .connection, act: {})
        GenerationTimeline(wait: DebugLessonWait.sample(reported: 3).finished)
      }
      .padding(.vertical, 8)
    }
  }

  /// `ZOONK_DEBUG_GALLERY=lessonWait` (or `lessonUnwritten`, `lessonFailed`, `lessonSetAside`) opens
  /// a lesson's wait as the player shows it, with a run's first minute already reported.
  private struct DebugLessonWait: View {
    let writing: LessonPlayerStore.LessonWriting

    static func writing(_ section: String) -> LessonPlayerStore.LessonWriting? {
      switch section {
      case "lessonWait": .writing
      case "lessonUnwritten": .notStarted
      case "lessonFailed": .failed
      case "lessonSetAside": .setAside
      default: nil
      }
    }

    /// `reported` of the lesson's events: planning started, planning finished, writing started.
    static func sample(reported: Int) -> GenerationWait {
      let now = Date.now
      let events = [
        GenerationEvent(at: now.addingTimeInterval(-60), status: "started", step: "planLesson"),
        GenerationEvent(at: now.addingTimeInterval(-8), status: "completed", step: "planLesson"),
        GenerationEvent(at: now.addingTimeInterval(-7), status: "started", step: "writeLesson"),
      ]
      var wait = GenerationWait(kind: .lesson).started

      for event in events.prefix(reported) {
        wait.apply(event, receivedAt: event.at ?? now)
      }

      return wait
    }

    private let outline = LessonOutline(
      id: "debug", title: "Porcentagem e descontos",
      description:
        "Quanto você paga de verdade numa promoção, e o desconto real por trás do “leve 3, pague 2”.",
      estimatedMinutes: 5)

    var body: some View {
      LessonWaitingView(
        outline: outline, writing: writing,
        progress: writing == .failed ? Self.sample(reported: 3) : Self.sample(reported: 1),
        alternative: .case2(.init(dueSkills: 1, kind: .review))
      ) {}
      .lonePage()
      .navigationTitle(outline.title)
      .navigationBarTitleDisplayMode(.inline)
      .taskClose {
        Button {
        } label: {
          Label {
            Text(verbatim: "Close lesson")
          } icon: {
            Image(systemName: "xmark")
          }
        }
      }
    }
  }

  private struct Meters: View {
    var body: some View {
      VStack(alignment: .leading, spacing: 12) {
        Meter(value: 0.36)
        Meter(value: 0.7, fill: .brain)
        HStack(spacing: 24) {
          BrainPowerReward(points: 50, earned: false)
          BrainPowerReward(points: 50, earned: true)
        }
        Meter(value: 40, total: 100, fill: .energy)
        MeterParts(parts: [
          .init(fill: .color(.success)), .init(weight: 2, fill: .current),
          .init(weight: 3, fill: .track), .init(fill: .color(LearnKind.review.color)),
          .init(weight: 4, fill: .color(LearnKind.conversation.color)),
        ])
        TaskSegments(
          segments: [.right, .wrong, .read, .current, .ahead, .ahead],
          label: Text(verbatim: "Lesson progress"))

        BigQuantity("38 min left")

        FlowLayout(spacing: 32, alignment: .firstTextBaseline) {
          MomentReadout {
            Text(verbatim: "8/10")
          } words: {
            Text(verbatim: "Right")
          }
          MomentReadout(tint: .brainText) {
            Text(verbatim: "+120")
          } words: {
            Text(verbatim: "Brain Power")
          }
        }

        HStack(spacing: 12) {
          GoalRing(share: 1, size: 26) {
            Image(systemName: "checkmark").foregroundStyle(.success)
          }
          GoalRing(share: 0.4, track: .today, size: 26) {}
          GoalRing(share: 0, track: .missed, size: 26) {}
          GoalRing(share: 0, track: .rest, size: 26) {}
        }
      }
      .padding(.vertical, 8)
    }
  }

  private struct Marks: View {
    var body: some View {
      HStack(spacing: 16) {
        StatusMark(status: .done)
        StatusMark(status: .next)
        StatusMark(status: .skipped)
        StatusMark(status: .todo)
        KindMark(kind: .lesson)
        KindMark(kind: .review)
        KindMark(kind: .mock)
        KindMark(kind: .conversation)
        KindMark(kind: .mindMap)
      }

      HStack(spacing: 6) {
        ForEach(ProgressBelt.allCases, id: \.self) { belt in
          RoundedRectangle(cornerRadius: 3, style: .continuous)
            .fill(belt.color)
            .overlay(RoundedRectangle(cornerRadius: 3, style: .continuous).strokeBorder(.border))
            .frame(height: 14)
        }
      }
    }
  }

  private struct Options: View {
    var body: some View {
      VStack(spacing: 10) {
        AnswerOption(marker: 1, action: {}) { Text(verbatim: "An option at rest") }
        AnswerOption(marker: 2, isPicked: true, action: {}) { Text(verbatim: "The learner's pick") }
        AnswerOption(marker: 3, result: .right, isLocked: true, action: {}) {
          Text(verbatim: "Checked right")
        }
        AnswerOption(marker: 4, isPicked: true, result: .wrong, isLocked: true, action: {}) {
          Text(verbatim: "Checked wrong")
        }
        AnswerOption(marker: 5, isPicked: true, result: .guess, isLocked: true, action: {}) {
          Text(verbatim: "A guess, checked")
        }
      }
      .padding(.vertical, 8)
    }
  }
#endif
