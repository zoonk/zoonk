import SwiftUI

/// Any complete structure with the formula's atoms is right.
struct MoleculeBuilderCanvas: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  let context: ActivityCanvasContext
  let fields: MoleculeBuilderFields

  private struct Snapshot: Hashable {
    var build: MoleculeBuild
    var layout: [String: MoleculeModel.Point]
    var selectedId: String?
  }

  @State private var state: Snapshot
  @State private var history: [Snapshot] = []

  init(context: ActivityCanvasContext, fields: MoleculeBuilderFields) {
    self.context = context
    self.fields = fields

    let answered = context.answer.flatMap { try? $0.decode(as: MoleculeBuild.self) }
    let build = answered.flatMap { $0.kind == "molecule" ? $0 : nil } ?? .empty
    _state = State(
      initialValue: Snapshot(build: build, layout: MoleculeModel.layout(build), selectedId: nil))
  }

  private var target: [(element: String, count: Int)] { MoleculeModel.parse(fields.formula) ?? [] }

  private var isChecked: Bool {
    if case .checked = context.phase { return true }
    return false
  }

  var body: some View {
    ChartsCanvas {
      if context.phase == .explore {
        example(title: nil)
      } else {
        question
      }
    }
  }

  @ViewBuilder
  private var question: some View {
    let build = state.build
    let selectedName: String? = build.atoms.first { $0.id == state.selectedId }.map { name($0) }

    header(build)
    drawing(build)
    status(build, selectedName: selectedName)

    if !isChecked {
      tools(selectedName: selectedName)
      palette(selectedName: selectedName)
    }

    if isChecked, !isRightInteraction {
      example(
        title: Text(
          "One correct build", tableName: "ActivitiesCharts",
          comment: "Above a complete molecule after the check"))
    }
  }

  private func header(_ build: MoleculeBuild) -> some View {
    let order = target.map(\.element)
    let built = MoleculeModel.formulaText(MoleculeModel.builtCounts(build, order: order))

    return HStack {
      Text(
        "Target: \(MoleculeModel.formulaText(target))", tableName: "ActivitiesCharts",
        comment: "The molecule to build, like Target: CO₂"
      )
      .font(.subheadline.weight(.medium))
      Spacer()
      if !build.atoms.isEmpty {
        Text(
          "Built: \(built)", tableName: "ActivitiesCharts",
          comment: "What the learner built so far, like Built: CO"
        )
        .font(.subheadline)
        .foregroundStyle(.secondary)
      }
    }
  }

  private func drawing(_ build: MoleculeBuild) -> some View {
    let onPress: ((String) -> Void)? = isChecked ? nil : { press($0) }

    return MoleculeDrawing(
      build: build, layout: state.layout, selectedId: isChecked ? nil : state.selectedId,
      atomLabel: { atomLabel($0, in: $1) }, onPress: onPress
    )
    .animation(reduceMotion ? nil : .snappy, value: state.layout)
  }

  private var isRightInteraction: Bool {
    guard case .interaction = context.check else { return false }
    return MoleculeModel.isComplete(state.build, target)
  }

  @ViewBuilder
  private func example(title: Text?) -> some View {
    if let structure = MoleculeModel.findStructure(target) {
      VStack(alignment: .leading, spacing: 8) {
        title?.font(.subheadline.weight(.medium))

        if title == nil {
          Text(verbatim: MoleculeModel.formulaText(target)).font(.headline)
        }

        MoleculeDrawing(
          build: structure, layout: MoleculeModel.layout(structure), selectedId: nil,
          atomLabel: { atomLabel($0, in: $1) }, onPress: nil)

        Text(
          "\(MoleculeModel.bondCount(target)) bonds in all, counting a double bond as two.",
          tableName: "ActivitiesCharts", comment: "How many bonds a complete molecule has"
        )
        .font(.footnote)
        .foregroundStyle(.secondary)
      }
      .accessibilityElement(children: .combine)
      .accessibilityValue(Text(verbatim: describe(structure)))
    }
  }

  private func elementName(_ element: String) -> String {
    switch element {
    case "B": String(localized: "Boron", table: "ActivitiesCharts", comment: "A chemical element")
    case "Br":
      String(localized: "Bromine", table: "ActivitiesCharts", comment: "A chemical element")
    case "C": String(localized: "Carbon", table: "ActivitiesCharts", comment: "A chemical element")
    case "Cl":
      String(localized: "Chlorine", table: "ActivitiesCharts", comment: "A chemical element")
    case "F":
      String(localized: "Fluorine", table: "ActivitiesCharts", comment: "A chemical element")
    case "H":
      String(localized: "Hydrogen", table: "ActivitiesCharts", comment: "A chemical element")
    case "I": String(localized: "Iodine", table: "ActivitiesCharts", comment: "A chemical element")
    case "N":
      String(localized: "Nitrogen", table: "ActivitiesCharts", comment: "A chemical element")
    case "O": String(localized: "Oxygen", table: "ActivitiesCharts", comment: "A chemical element")
    case "P":
      String(localized: "Phosphorus", table: "ActivitiesCharts", comment: "A chemical element")
    case "S": String(localized: "Sulfur", table: "ActivitiesCharts", comment: "A chemical element")
    case "Si":
      String(localized: "Silicon", table: "ActivitiesCharts", comment: "A chemical element")
    default: element
    }
  }

  private func name(_ atom: MoleculeBuild.Atom) -> String {
    let number = String(atom.id.drop { !$0.isNumber })
    return String(
      localized: "\(elementName(atom.element)) \(number)", table: "ActivitiesCharts",
      comment: "An atom's name, like Oxygen 2")
  }

  private func atomLabel(_ atom: MoleculeBuild.Atom, in build: MoleculeBuild) -> String {
    let used = MoleculeModel.bondsUsed(build, atom.id)
    return String(
      localized: "\(name(atom)): \(used) of \(MoleculeModel.valence(of: atom.element)) bonds",
      table: "ActivitiesCharts",
      comment: "An atom with its bonds used out of the bonds it makes, like Carbon 1: 2 of 4 bonds")
  }

  private func status(_ build: MoleculeBuild, selectedName: String?) -> some View {
    let over = build.atoms.first {
      MoleculeModel.bondsUsed(build, $0.id) > MoleculeModel.valence(of: $0.element)
    }
    let open = build.atoms.filter {
      MoleculeModel.bondsUsed(build, $0.id) < MoleculeModel.valence(of: $0.element)
    }.count

    return VStack(alignment: .leading, spacing: 4) {
      if build.atoms.isEmpty {
        Text(
          "Tap an element to add its first atom.", tableName: "ActivitiesCharts",
          comment: "An empty molecule build"
        )
        .foregroundStyle(.secondary)
      } else if let over {
        Text(
          "\(name(over)) has more bonds than it can make.", tableName: "ActivitiesCharts",
          comment: "An atom with too many bonds"
        )
        .foregroundStyle(.destructive)
        .fontWeight(.medium)
      } else if open > 0 {
        Text(
          "\(open) atoms have open bonds, shown as dots.", tableName: "ActivitiesCharts",
          comment: "Atoms that still need bonds"
        )
        .foregroundStyle(.secondary)
      } else {
        Text(
          "Every atom has all its bonds.", tableName: "ActivitiesCharts",
          comment: "A complete molecule"
        )
        .foregroundStyle(.success)
        .fontWeight(.medium)
      }

      if !isChecked && !build.atoms.isEmpty {
        Group {
          if let selectedName {
            Text(
              "\(selectedName) is selected. Tap another atom to bond them, or an element to add one bonded to it.",
              tableName: "ActivitiesCharts", comment: "What to do with a selected atom")
          } else {
            Text(
              "Tap an atom to select it.", tableName: "ActivitiesCharts",
              comment: "How to start bonding atoms")
          }
        }
        .foregroundStyle(.secondary)
      }
    }
    .font(.subheadline)
  }

  private func tools(selectedName: String?) -> some View {
    HStack {
      Button(action: undo) {
        Label {
          Text("Undo", tableName: "ActivitiesCharts", comment: "Undoes the last move")
        } icon: {
          Image(systemName: "arrow.uturn.backward")
        }
      }
      .disabled(history.isEmpty)

      Button(role: .destructive, action: remove) {
        Label {
          Text("Remove", tableName: "ActivitiesCharts", comment: "Removes the selected atom")
        } icon: {
          Image(systemName: "trash")
        }
      }
      .disabled(selectedName == nil)
      .accessibilityLabel(
        selectedName.map {
          Text(
            "Remove \($0)", tableName: "ActivitiesCharts",
            comment: "Removes an atom, like Remove Oxygen 2")
        }
          ?? Text(
            "Remove the selected atom", tableName: "ActivitiesCharts",
            comment: "Removes the selected atom"))
    }
    .buttonStyle(.bordered)
  }

  private func palette(selectedName: String?) -> some View {
    LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 8)], spacing: 8) {
      ForEach(fields.elements, id: \.self) { element in
        Button {
          add(element)
        } label: {
          VStack(spacing: 2) {
            Text(verbatim: element).font(.headline)
            Text(
              "\(MoleculeModel.valence(of: element)) bonds", tableName: "ActivitiesCharts",
              comment: "How many bonds an element makes"
            )
            .font(.caption)
            .foregroundStyle(.secondary)
          }
          .padding(.vertical, 6)
        }
        .buttonStyle(ChartsChoiceStyle())
        .disabled(state.build.atoms.count >= 16)
        .accessibilityLabel(
          selectedName.map {
            Text(
              "Add \(elementName(element)) bonded to \($0)", tableName: "ActivitiesCharts",
              comment: "Adds an atom bonded to the selected one")
          }
            ?? Text(
              "Add \(elementName(element))", tableName: "ActivitiesCharts",
              comment: "Adds an atom, like Add Oxygen"))
      }
    }
  }

  private func commit(_ next: Snapshot, announce: String) {
    history.append(state)
    state = next
    changed(announce)
  }

  private func changed(_ text: String) {
    AccessibilityNotification.Announcement(text).post()

    switch context.check {
    case .numeric:
      context.setAnswer(
        state.build.bonds.isEmpty
          ? nil : .numeric(Double(state.build.bonds.reduce(0) { $0 + $1.order })))
    case .interaction:
      context.setAnswer(
        state.build.atoms.isEmpty ? nil : try? ActivityAnswer(encoding: state.build))
    default:
      break
    }
  }

  private func add(_ element: String) {
    let (build, id) = MoleculeModel.add(element, to: state.build, bondTo: state.selectedId)
    var layout = state.layout
    layout[id] = MoleculeModel.place(anchor: state.selectedId, layout: state.layout)
    let atom = build.atoms.first { $0.id == id }
    let anchor = state.build.atoms.first { $0.id == state.selectedId }
    let text =
      anchor.map { anchor in
        String(
          localized: "Added \(atom.map(name) ?? ""), bonded to \(name(anchor)).",
          table: "ActivitiesCharts", comment: "Announced after adding a bonded atom")
      }
      ?? String(
        localized: "Added \(atom.map(name) ?? "").", table: "ActivitiesCharts",
        comment: "Announced after adding an atom")

    commit(
      Snapshot(
        build: build, layout: MoleculeModel.relax(layout, bonds: build.bonds),
        selectedId: state.selectedId ?? id),
      announce: text)
  }

  private func press(_ id: String) {
    guard let selectedId = state.selectedId, selectedId != id else {
      let next = state.selectedId == id ? nil : id
      state.selectedId = next
      let atom = state.build.atoms.first { $0.id == next }
      let text =
        atom.map {
          String(
            localized: "\(name($0)) selected.", table: "ActivitiesCharts",
            comment: "Announced when an atom is selected")
        }
        ?? String(
          localized: "Nothing selected.", table: "ActivitiesCharts",
          comment: "Announced when no atom is selected")
      AccessibilityNotification.Announcement(text).post()
      return
    }

    let build = MoleculeModel.stepBond(state.build, selectedId, id)
    let order = MoleculeModel.bondOrder(build, selectedId, id)
    let first = build.atoms.first { $0.id == selectedId }.map(name) ?? ""
    let second = build.atoms.first { $0.id == id }.map(name) ?? ""

    commit(
      Snapshot(
        build: build, layout: MoleculeModel.relax(state.layout, bonds: build.bonds),
        selectedId: selectedId),
      announce: bondText(first, second, order))
  }

  private func bondText(_ first: String, _ second: String, _ order: Int) -> String {
    String(
      localized: "\(first) and \(second): \(bondName(order)).", table: "ActivitiesCharts",
      comment: "Two atoms and the bond between them, like Carbon 1 and Oxygen 1: double bond.")
  }

  private func bondName(_ order: Int) -> String {
    switch order {
    case 0: String(localized: "no bond", table: "ActivitiesCharts", comment: "Two atoms not bonded")
    case 1: String(localized: "single bond", table: "ActivitiesCharts", comment: "A single bond")
    case 2: String(localized: "double bond", table: "ActivitiesCharts", comment: "A double bond")
    default: String(localized: "triple bond", table: "ActivitiesCharts", comment: "A triple bond")
    }
  }

  private func remove() {
    guard let selectedId = state.selectedId else {
      return
    }

    let atom = state.build.atoms.first { $0.id == selectedId }
    let build = MoleculeModel.remove(selectedId, from: state.build)
    var layout = state.layout
    layout[selectedId] = nil

    commit(
      Snapshot(
        build: build, layout: MoleculeModel.relax(layout, bonds: build.bonds), selectedId: nil),
      announce: String(
        localized: "Removed \(atom.map(name) ?? "").", table: "ActivitiesCharts",
        comment: "Announced after removing an atom"))
  }

  private func undo() {
    guard let previous = history.popLast() else {
      return
    }

    state = previous
    changed(
      String(localized: "Undone.", table: "ActivitiesCharts", comment: "Announced after undo"))
  }

  private func describe(_ build: MoleculeBuild) -> String {
    let named = { (id: String) in build.atoms.first { $0.id == id }.map(name) ?? id }
    let bonds = build.bonds.map { bondText(named($0.from), named($0.to), $0.order) }
    let loose = build.atoms.filter { atom in
      !build.bonds.contains { $0.from == atom.id || $0.to == atom.id }
    }
    .map {
      String(
        localized: "\(name($0)) has no bonds.", table: "ActivitiesCharts",
        comment: "An atom with no bonds, for VoiceOver")
    }

    return (bonds + loose).joined(separator: " ")
  }
}

private struct MoleculeDrawing: View {
  let build: MoleculeBuild
  let layout: [String: MoleculeModel.Point]
  let selectedId: String?
  let atomLabel: (MoleculeBuild.Atom, MoleculeBuild) -> String
  let onPress: ((String) -> Void)?

  private static let radius = 23.0

  var body: some View {
    GeometryReader { geometry in
      let scale = min(
        geometry.size.width / MoleculeModel.size.width,
        geometry.size.height / MoleculeModel.size.height)
      let offset = CGPoint(
        x: (geometry.size.width - MoleculeModel.size.width * scale) / 2,
        y: (geometry.size.height - MoleculeModel.size.height * scale) / 2)
      let at = { (id: String) -> CGPoint? in
        layout[id].map { CGPoint(x: offset.x + $0.x * scale, y: offset.y + $0.y * scale) }
      }

      ZStack {
        Canvas { canvas, _ in
          for bond in build.bonds {
            guard let from = at(bond.from), let to = at(bond.to) else { continue }
            let length = max(hypot(to.x - from.x, to.y - from.y), 1)
            let normal = CGPoint(x: -(to.y - from.y) / length, y: (to.x - from.x) / length)

            for line in 0..<bond.order {
              let shift = (Double(line) - Double(bond.order - 1) / 2) * 6
              var path = Path()
              path.move(to: CGPoint(x: from.x + normal.x * shift, y: from.y + normal.y * shift))
              path.addLine(to: CGPoint(x: to.x + normal.x * shift, y: to.y + normal.y * shift))
              canvas.stroke(path, with: .style(.primary), lineWidth: 2.5)
            }
          }
        }

        ForEach(build.atoms, id: \.id) { atom in
          if let point = at(atom.id) {
            atomView(atom, scale: scale)
              .position(point)
          }
        }
      }
    }
    .aspectRatio(MoleculeModel.size.width / MoleculeModel.size.height, contentMode: .fit)
    .frame(maxWidth: 480)
    .frame(maxWidth: .infinity)
  }

  @ViewBuilder
  private func atomView(_ atom: MoleculeBuild.Atom, scale: CGFloat) -> some View {
    let open = MoleculeModel.valence(of: atom.element) - MoleculeModel.bondsUsed(build, atom.id)
    let size = Self.radius * 2 * scale
    let style = Self.style(atom.element)

    let circle = ZStack {
      Circle().fill(style.fill)
      Circle().strokeBorder(
        atom.id == selectedId ? Color.primary : Color(.separator),
        lineWidth: atom.id == selectedId ? 3 : 1)
      Text(verbatim: atom.element)
        .font(.headline)
        .foregroundStyle(style.text)
      ForEach(0..<max(open, 0), id: \.self) { index in
        let angle = Double(index) * 2 * .pi / Double(max(open, 1))
        Circle()
          .fill(.primary)
          .frame(width: 6, height: 6)
          .offset(x: sin(angle) * (size / 2 + 6), y: -cos(angle) * (size / 2 + 6))
      }
    }
    .frame(width: size, height: size)
    .frame(width: max(size, 44), height: max(size, 44))
    .contentShape(.circle)

    if let onPress {
      Button {
        onPress(atom.id)
      } label: {
        circle
      }
      .buttonStyle(.plain)
      .accessibilityLabel(Text(verbatim: atomLabel(atom, build)))
      .accessibilityAddTraits(atom.id == selectedId ? .isSelected : [])
    } else {
      circle
        .accessibilityElement()
        .accessibilityLabel(Text(verbatim: atomLabel(atom, build)))
    }
  }

  /// Atoms in the colors chemistry draws them (CPK), adapted to the system palette.
  private static func style(_ element: String) -> (fill: Color, text: Color) {
    switch element {
    case "C": (Color(.darkGray), .white)
    case "H": (Color(.systemBackground), .primary)
    case "O": (.red, .white)
    case "N": (.blue, .white)
    case "S": (.yellow, .black)
    case "P": (.orange, .black)
    case "Cl", "F": (.green, .black)
    case "Br": (.brown, .white)
    case "I": (.purple, .white)
    case "B": (.pink, .black)
    default: (Color(.systemGray3), .primary)
    }
  }
}
