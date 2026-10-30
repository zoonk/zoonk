#if DEBUG
  import SwiftUI

  /// `ZOONK_DEBUG_CHARACTERS=ceremony` opens a milestone's ceremony instead, and `=moments` a
  /// result's missions.
  struct DebugCharacterGallery: ViewModifier {
    private let mode = ProcessInfo.processInfo.environment["ZOONK_DEBUG_CHARACTERS"]

    func body(content: Content) -> some View {
      if let mode {
        content.fullScreenCover(isPresented: .constant(true)) {
          if mode == "ceremony" {
            CeremonyPreview()
          } else if mode == "moments" {
            MomentsPreview()
          } else {
            Gallery()
          }
        }
      } else {
        content
      }
    }
  }

  private let kinds: [BuddyKind] = [.zu, .noodle, .beep, .otto]
  private let glasses: [BuddyGlasses] = [.round, .star, .aviator, .catEye, .retro, .monocle]

  private struct Gallery: View {
    @State private var kind = BuddyKind.zu
    @State private var buddyCue: ActCue<BuddyAct>?
    @State private var tricksterCue: ActCue<TricksterAct>?
    @State private var cues = 0

    var body: some View {
      NavigationStack {
        List {
          Section {
            Picker(selection: $kind) {
              ForEach(kinds, id: \.self) { Text(verbatim: $0.rawValue).tag($0) }
            } label: {
              Text(verbatim: "Buddy")
            }
            .pickerStyle(.segmented)

            BuddyCharacter(look: BuddyLook(kind: kind, belt: .blue, energy: 50), cue: buddyCue)
              .frame(height: 200)
              .frame(maxWidth: .infinity)

            ActButtons(acts: BuddyAct.allCases) { act in
              cues += 1
              buddyCue = ActCue(id: cues, act: act)
            }
          } header: {
            Text(verbatim: "Acts")
          }

          Section {
            HStack {
              ForEach([ProgressBelt.yellow, .green, .black], id: \.self) { belt in
                BuddyCharacter(look: BuddyLook(kind: kind, belt: belt, energy: 50))
              }
            }
            .frame(height: 110)
          } header: {
            Text(verbatim: "Stages: baby (yellow), young (green), adult (black)")
          }

          Section {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4)) {
              ForEach(BuddyExpression.allCases, id: \.self) { expression in
                VStack {
                  BuddyCharacter(look: BuddyLook(kind: kind, belt: .red), expression: expression)
                    .frame(height: 72)
                  Text(verbatim: "\(expression)").font(.caption2)
                }
              }
            }
          } header: {
            Text(verbatim: "Expressions")
          }

          Section {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 6)) {
              ForEach(glasses, id: \.self) { pair in
                BuddyCharacter(look: BuddyLook(kind: kind, glasses: pair), crop: .face)
                  .frame(height: 48)
              }
            }
            Label {
              Text(verbatim: "Face at text size")
            } icon: {
              BuddyFace(kind: kind)
            }
          } header: {
            Text(verbatim: "Glasses, cropped to the face")
          }

          Section {
            HStack {
              BuddyCharacter(look: BuddyLook(kind: kind, energy: 10))
              BuddyCharacter(look: BuddyLook(kind: kind, energy: 50))
              BuddyCharacter(look: BuddyLook(kind: kind, energy: 95))
            }
            .frame(height: 110)
          } header: {
            Text(verbatim: "Energy: napping, awake, glowing")
          }

          Section {
            HStack {
              TricksterCharacter()
              TricksterCharacter(beaten: true)
              CharacterActor(art: TricksterArt(holdsSign: true), expression: .smug)
            }
            .frame(height: 120)

            TricksterCharacter(cue: tricksterCue)
              .frame(height: 200)
              .frame(maxWidth: .infinity)

            ActButtons(acts: TricksterAct.allCases) { act in
              cues += 1
              tricksterCue = ActCue(id: cues, act: act)
            }
          } header: {
            Text(verbatim: "The Trickster")
          }
        }
        .navigationTitle(Text(verbatim: "Characters"))
      }
    }
  }

  private struct ActButtons<Act: Hashable>: View {
    let acts: [Act]
    let play: (Act) -> Void

    var body: some View {
      ScrollView(.horizontal) {
        HStack {
          ForEach(acts, id: \.self) { act in
            Button {
              play(act)
            } label: {
              Text(verbatim: "\(act)")
            }
            .buttonStyle(.bordered)
          }
        }
      }
    }
  }

  private struct CeremonyPreview: View {
    @State private var index = 0

    private let milestones = [
      Milestone(id: "debug-belt", key: "orange", kind: "belt"),
      Milestone(id: "debug-stage", key: "adult", kind: "buddyStage"),
      Milestone(id: "debug-glasses", key: "aviator", kind: "glasses"),
      Milestone(id: "debug-black-belt", key: "black", kind: "belt"),
    ]

    var body: some View {
      MilestoneCeremony(milestone: milestones[index % milestones.count]) {
        index += 1
      }
      .id(index)
    }
  }
  private struct MomentsPreview: View {
    private enum Variant: String, CaseIterable {
      case oneDone = "One mission done"
      case allDone = "All missions done"
      case reached = "Level and Energy"
      case maxEnergy = "Max Energy"
    }

    @State private var variant = Variant.oneDone

    private func result(_ variant: Variant) -> DayResult? {
      let paid = variant == .allDone
      let moment = """
        {"completed": ["review"], "fullMeal": {"bonus": 50, "paid": \(paid)},
          "missions": [
            {"detail": null, "done": 1, "kind": "review", "minutes": 5, "opens": null,
             "status": "done", "total": 1, "waitReason": null},
            {"detail": null, "done": \(paid ? 1 : 0), "kind": "somethingNew", "minutes": 10,
             "opens": null, "status": "\(paid ? "done" : "todo")", "total": 1,
             "waitReason": null},
            {"detail": null, "done": \(paid ? 2 : 1), "kind": "fixMistake", "minutes": 4,
             "opens": null, "status": "\(paid ? "done" : "todo")", "total": 2,
             "waitReason": null}]}
        """
      let json =
        switch variant {
        case .oneDone, .allDone:
          #"{"ceremony": null, "reached": null, "missionMoment": \#(moment)}"#
        case .reached:
          """
          {"ceremony": null, "missionMoment": null,
           "reached": {"energy": 80, "level": {"color": "yellow", "level": 3}}}
          """
        case .maxEnergy:
          #"{"ceremony": null, "missionMoment": null, "reached": {"energy": 100, "level": null}}"#
        }
      return try? JSONDecoder().decode(DayResult.self, from: Data(json.utf8))
    }

    var body: some View {
      NavigationStack {
        List {
          Picker(selection: $variant) {
            ForEach(Variant.allCases, id: \.self) { Text(verbatim: $0.rawValue).tag($0) }
          } label: {
            Text(verbatim: "Moment")
          }

          if let result = result(variant) {
            DayMomentSections(result: result)
              .id(variant)
          }
        }
        .navigationTitle(Text(verbatim: "Moments"))
      }
    }
  }
#endif
