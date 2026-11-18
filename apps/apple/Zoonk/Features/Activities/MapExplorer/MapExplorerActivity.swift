import SwiftUI

extension ActivityRenderer {
  static let mapExplorer = ActivityRenderer(template: "mapExplorer") {
    context in
    if let fields = try? context.fields(as: MapExplorerFields.self) {
      if let map = context.baseMap {
        MapExplorerCanvas(
          fields: fields, map: map,
          question: {
            switch context.check {
            case .choice(let question, _, _, _): return question
            case .numeric(let question, _, _, _, _, _, _): return question
            default: return ""
            }
          }(),
          references: {
            let checkReferences =
              switch context.check {
              case .choice(let question, let options, _, _):
                ([question] + options.map(\.text)).joined(separator: " ")
              case .numeric(let question, _, _, _, _, _, _): question
              default: ""
              }
            return ([checkReferences] + fields.places.map(\.label)).joined(separator: " ")
          }())
      } else {
        Text(
          "This map can't be shown. Continue to the next screen.", tableName: "Activities",
          comment: "A map activity whose map isn't available"
        )
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
      }
    }
  }
}

struct MapExplorerFields: Decodable, Hashable, Sendable {
  struct Place: Decodable, Hashable, Sendable, Identifiable {
    let id: String
    let label: String
    let reveals: String
  }

  let baseMapId: String
  let places: [Place]
}

private struct MapExplorerCanvas: View {
  let fields: MapExplorerFields
  let map: ActivityBaseMap
  let question: String
  let references: String

  @ActivityState("selectedId") private var selectedId: String? = nil
  @ActivityState("visited") private var visited: [String] = []
  /// Main's `FALLBACK_WIDTH` until the column is measured.
  @State private var width = 318.0

  private static let pinSpacing = 40.0
  private static let maxHeight = 440.0

  var body: some View {
    let selected = fields.places.firstIndex { $0.id == selectedId }

    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .firstTextBaseline) {
        ActivityCaption(MapWords.name(fields.baseMapId))
        Spacer()
        ActivityCaption(
          Text(
            "\(visited.count) of \(fields.places.count) explored", tableName: "Activities",
            comment: "How many places of a map the learner has looked at"))
      }

      drawing(width: width)
        .frame(maxWidth: .infinity, alignment: .leading)
        .onGeometryChange(for: Double.self) {
          $0.size.width
        } action: {
          width = max($0, 1)
        }

      if !map.legend.isEmpty {
        FlowLayout(spacing: 12) {
          ForEach(map.legend, id: \.key) { item in
            Label {
              MapWords.label(key: item.key, text: item.key)
            } icon: {
              RoundedRectangle(cornerRadius: 2)
                .fill(item.tone.fill)
                .strokeBorder(.border)
                .frame(width: 12, height: 12)
            }
          }
        }
        .typeStyle(.meta)
        .foregroundStyle(.mutedForeground)
        .accessibilityHidden(true)
      }

      if let note = MapWords.note(fields.baseMapId) {
        ActivityCaption(note)
      }

      if let selected {
        let place = fields.places[selected]

        VStack(alignment: .leading, spacing: 4) {
          Text(
            "\(selected + 1). \(place.label)", tableName: "Activities",
            comment: "A map place's number, then its name"
          )
          .typeStyle(.body.weight(.semibold))
          LessonRichText(place.reveals)
            .typeStyle(.body)
        }
        .accessibilityElement(children: .combine)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .activityBox(cornerRadius: Radius.option)
      }
    }
  }

  private var points: [CGPoint] {
    fields.places.compactMap { place in
      map.places.first { $0.id == place.id }.map { CGPoint(x: $0.x, y: $0.y) }
    }
  }

  private func crop(width: Double) -> CGRect {
    MapViewport.fit(
      map: CGSize(width: map.width, height: map.height), maxAspect: Self.maxHeight / width,
      maxZoom: map.maxZoom, points: points,
      minAspect: map.streets.isEmpty ? nil : MapViewport.maxAspect)
  }

  @ViewBuilder
  private func drawing(width: Double) -> some View {
    let crop = crop(width: width)
    let scale = width / crop.width
    let height = crop.height * scale
    let pins = fields.places.enumerated().compactMap { index, place in
      map.places.first { $0.id == place.id }.map { spot in
        (
          index: index, place: place,
          spot: CGPoint(x: (spot.x - crop.minX) * scale, y: (spot.y - crop.minY) * scale)
        )
      }
    }
    let shown = MapViewport.spread(
      pins.map(\.spot), distance: Self.pinSpacing, in: CGSize(width: width, height: height))

    let naming = MapNaming(
      map: map, crop: crop, scale: scale, question: question, references: references,
      pins: zip(pins.map(\.spot), shown).map { (spot: $0, shown: $1) })

    ZStack(alignment: .topLeading) {
      MapShapes(naming: naming)
      .accessibilityElement()
      .accessibilityLabel(textAlternative)

      ForEach(Array(pins.enumerated()), id: \.element.place.id) { order, pin in
        self.pin(pin.place, number: pin.index + 1)
          .position(shown[order])
      }
      MapLabels(naming: naming)
      .allowsHitTesting(false)
      .accessibilityHidden(true)
    }
    .frame(width: width, height: height)
    .background(map.sphere == nil ? ActivityBaseMap.Tone.water : .clear)
    .clipShape(.rect(cornerRadius: Radius.option))
  }

  private var textAlternative: Text {
    let places = fields.places.enumerated().map { "\($0.offset + 1). \($0.element.label)" }
      .joined(separator: ", ")

    return Text(
      "\(MapWords.name(fields.baseMapId)) with \(fields.places.count) places to explore: \(places).",
      tableName: "Activities",
      comment: "VoiceOver: a map activity's map, its number of places, then each place")
  }

  private func pin(_ place: MapExplorerFields.Place, number: Int) -> some View {
    let isSelected = selectedId == place.id
    let isVisited = visited.contains(place.id)

    return Button {
      selectedId = place.id

      if !isVisited {
        visited.append(place.id)
      }

      announcePolitely(LessonRichText.spoken(place.reveals))
    } label: {
      Text(number, format: .number)
        .typeStyle(mapPinNumberStyle)
        .foregroundStyle(isSelected ? Color(.systemBackground) : ActivityBaseMap.Tone.pin)
        .frame(width: 32, height: 32)
        .background(
          isSelected
            ? ActivityBaseMap.Tone.pin
            : isVisited ? ActivityBaseMap.Tone.groupA.fill : Color(.systemBackground),
          in: .circle
        )
        .overlay { Circle().strokeBorder(ActivityBaseMap.Tone.pin, lineWidth: 2) }
        .shadow(radius: 2, y: 1)
        .frame(width: 44, height: 44)
        .contentShape(.circle)
    }
    .buttonStyle(.plain)
    .modifier(ActivityNumberKey(index: number - 1))
    .accessibilityLabel(
      Text(
        "\(number). \(place.label)", tableName: "Activities",
        comment: "VoiceOver: a numbered place on a map")
    )
    .accessibilityAddTraits(isSelected ? .isSelected : [])
  }
}

/// Mirrors main's `BaseMapView`.
private struct MapShapes: View {
  let naming: MapNaming

  var body: some View {
    Canvas { context, size in
      let map = naming.map
      let transform = naming.transform
      let unnamed = naming.unnamedRegions(naming.layout(in: context, size: size).spots)

      func path(_ data: String) -> Path {
        svg(data).applying(transform)
      }

      if let sphere = map.sphere {
        context.fill(path(sphere), with: .color(ActivityBaseMap.Tone.water))
      }

      for (index, region) in map.regions.enumerated() where !unnamed.contains(index) {
        let shape = path(region.path)
        context.fill(shape, with: .color(region.tone.fill))
        context.stroke(
          shape, with: .color(Color.vizGrid),
          style: StrokeStyle(lineWidth: 0.75, lineJoin: .round))
      }

      for street in map.streets {
        context.stroke(
          path(street.path), with: .color(Color(.systemBackground)),
          style: StrokeStyle(lineWidth: 9, lineCap: .round, lineJoin: .round))
      }

      for inset in map.insets {
        context.stroke(
          Path(
            CGRect(x: inset.x, y: inset.y, width: inset.width, height: inset.height).applying(
              transform)),
          with: .color(Color.vizGrid), lineWidth: 1)
      }

      for pin in naming.pins {
        if pin.spot != pin.shown {
          var line = Path()
          line.move(to: pin.spot)
          line.addLine(to: pin.shown)
          context.stroke(line, with: .color(ActivityBaseMap.Tone.pin), lineWidth: 1.5)
        }

        context.fill(
          Path(ellipseIn: CGRect(x: pin.spot.x - 3.5, y: pin.spot.y - 3.5, width: 7, height: 7)),
          with: .color(ActivityBaseMap.Tone.pin))
      }
    }
  }
}

/// Where the map's names go, measured as the labels draw them. The shapes read it too, so a
/// colored block whose name can't be placed isn't drawn unnamed.
private struct MapNaming {
  let map: ActivityBaseMap
  let crop: CGRect
  let scale: Double
  let question: String
  let references: String
  let pins: [(spot: CGPoint, shown: CGPoint)]

  var transform: CGAffineTransform {
    CGAffineTransform(scaleX: scale, y: scale).translatedBy(x: -crop.minX, y: -crop.minY)
  }

  func layout(in context: GraphicsContext, size: CGSize) -> (
    texts: [Text], spots: [MapViewport.Placement?]
  ) {
    let transform = self.transform
    func path(_ data: String) -> Path { svg(data).applying(transform) }
    let texts = map.labels.map { label in
      MapWords.label(key: label.key, text: label.text).font(
        (label.kind == .street ? TypeStyle.small.weight(.medium) : .meta.weight(.semibold)).font(
          in: context.environment))
    }
    let streetPaths = map.streets.map { streetPositions(path($0.path)) }
    let labels = map.labels.enumerated().map { index, label in
      let positions = map.streets.firstIndex { $0.name == label.text }.map { streetPaths[$0] }
      return MapViewport.Label(
        center: CGPoint(x: label.x, y: label.y).applying(transform),
        size: context.resolve(texts[index]).measure(
          in: CGSize(width: CGFloat.infinity, height: CGFloat.infinity)), angle: label.angle,
        street: label.kind == .street,
        priority: MapViewport.isNamed(
          references: references, source: label.text,
          text: String(
            localized: String.LocalizationValue(label.text), table: "Activities",
            locale: context.environment.locale)),
        positions: positions,
        question: MapViewport.isNamed(
          references: question, source: label.text,
          text: String(
            localized: String.LocalizationValue(label.text), table: "Activities",
            locale: context.environment.locale))
      )
    }
    let pinFont = mapPinNumberStyle.uiFont(
      context.environment.dynamicTypeSize, legibility: context.environment.legibilityWeight)
    let pinNumbers = pins.enumerated().map { index, pin in
      let size = (String(index + 1) as NSString).size(withAttributes: [.font: pinFont])
      return CGRect(
        x: pin.shown.x - size.width / 2, y: pin.shown.y - size.height / 2, width: size.width,
        height: size.height)
    }
    let spots = MapViewport.placeLabels(
      labels, pins: pins.map(\.shown), frame: size, streets: streetPaths, pinNumbers: pinNumbers)
    return (texts, spots)
  }

  /// The colored regions whose name has no room on the map.
  func unnamedRegions(_ spots: [MapViewport.Placement?]) -> Set<Int> {
    Set(
      map.regions.indices.filter { index in
        let region = map.regions[index]
        guard region.tone != .context, region.tone != .focus else { return false }
        let bounds = svg(region.path).boundingRect
        let names = map.labels.indices.filter {
          map.labels[$0].kind == .region
            && bounds.contains(CGPoint(x: map.labels[$0].x, y: map.labels[$0].y))
        }
        return !names.isEmpty && names.allSatisfy { spots[$0] == nil }
      })
  }
}

private struct MapLabels: View {
  let naming: MapNaming

  var body: some View {
    Canvas { context, size in
      let map = naming.map
      let (texts, spots) = naming.layout(in: context, size: size)
      for (index, label) in map.labels.enumerated() {
        guard let point = spots[index] else { continue }
        let text = texts[index]
        var labelContext = context
        labelContext.translateBy(x: point.x, y: point.y)
        labelContext.rotate(by: .degrees(label.angle))
        labelContext.scaleBy(x: point.scale, y: point.scale)

        for offset in [
          CGSize(width: 1, height: 0), CGSize(width: -1, height: 0), CGSize(width: 0, height: 1),
          CGSize(width: 0, height: -1),
        ] {
          labelContext.draw(
            text.foregroundStyle(Color(.systemBackground)),
            at: CGPoint(x: offset.width, y: offset.height))
        }

        labelContext.draw(
          text.foregroundStyle(
            label.kind == .street ? Color.mutedForeground : Color.primary.opacity(0.75)),
          at: .zero)
      }

    }
  }
}

extension ActivityBaseMap.Tone {
  /// Main's `viz-accent`, the pins' color.
  static var pin: Color { .vizAccent }
  /// Main's `viz-secondary-soft`, the sea around a map.
  static var water: Color { .purple.opacity(0.14) }

  var fill: Color {
    switch self {
    case .context: Color.muted
    case .focus: Color(.systemBackground)
    case .groupA: .vizAccent.opacity(0.22)
    case .groupB: .vizHighlight.opacity(0.22)
    case .groupC: .vizSecondary.opacity(0.14)
    }
  }
}

/// Mirrors main's `use-base-map-words`.
private func streetPositions(_ path: Path) -> [CGPoint] {
  var start: CGPoint?
  path.cgPath.applyWithBlock { pointer in
    let element = pointer.pointee
    if start == nil, element.type == .moveToPoint { start = element.points.pointee }
  }
  let bounds = path.boundingRect
  let steps = max(1, Int(ceil((bounds.width + bounds.height) / MapViewport.streetSampleStep)))
  let rest = (1...steps).compactMap {
    path.trimmedPath(from: 0, to: CGFloat($0) / CGFloat(steps)).currentPoint
  }
  return [start].compactMap { $0 } + rest
}

private enum MapWords {
  static func name(_ id: String) -> Text {
    switch id {
    case "africa": Text("Map of Africa", tableName: "Activities", comment: "A base map's name")
    case "americas":
      Text("Map of the Americas", tableName: "Activities", comment: "A base map's name")
    case "asia": Text("Map of Asia", tableName: "Activities", comment: "A base map's name")
    case "brazil-states":
      Text("Map of Brazil by state", tableName: "Activities", comment: "A base map's name")
    case "europe": Text("Map of Europe", tableName: "Activities", comment: "A base map's name")
    case "europe-1914":
      Text("Map of Europe in 1914", tableName: "Activities", comment: "A base map's name")
    case "london-1854":
      Text("Map of Soho, London, in 1854", tableName: "Activities", comment: "A base map's name")
    case "roman-empire-117":
      Text(
        "Map of the Roman Empire in 117 CE", tableName: "Activities", comment: "A base map's name")
    case "usa-states":
      Text(
        "Map of the United States by state", tableName: "Activities", comment: "A base map's name")
    case "world-continents":
      Text("World map of the continents", tableName: "Activities", comment: "A base map's name")
    default: Text("World map", tableName: "Activities", comment: "A base map's name")
    }
  }

  static func note(_ id: String) -> Text? {
    switch id {
    case "europe-1914", "roman-empire-117":
      Text("Borders are simplified.", tableName: "Activities", comment: "Under a historical map")
    case "london-1854":
      Text(
        "Simplified street plan, after John Snow's 1854 map.", tableName: "Activities",
        comment: "Under the 1854 map of Soho, London")
    default: nil
    }
  }

  static func label(key: String?, text: String) -> Text {
    switch key {
    case "africa": Text("Africa", tableName: "Activities", comment: "A map label")
    case "antarctica": Text("Antarctica", tableName: "Activities", comment: "A map label")
    case "asia": Text("Asia", tableName: "Activities", comment: "A map label")
    case "austriaHungary": Text("Austria-Hungary", tableName: "Activities", comment: "A map label")
    case "europe": Text("Europe", tableName: "Activities", comment: "A map label")
    case "france": Text("France", tableName: "Activities", comment: "A map label")
    case "germanEmpire": Text("German Empire", tableName: "Activities", comment: "A map label")
    case "italy": Text("Italy", tableName: "Activities", comment: "A map label")
    case "northAmerica": Text("North America", tableName: "Activities", comment: "A map label")
    case "oceania": Text("Oceania", tableName: "Activities", comment: "A map label")
    case "ottomanEmpire": Text("Ottoman Empire", tableName: "Activities", comment: "A map label")
    case "parthianEmpire": Text("Parthian Empire", tableName: "Activities", comment: "A map label")
    case "romanEmpire": Text("Roman Empire", tableName: "Activities", comment: "A map label")
    case "russianEmpire": Text("Russian Empire", tableName: "Activities", comment: "A map label")
    case "serbia": Text("Serbia", tableName: "Activities", comment: "A map label")
    case "southAmerica": Text("South America", tableName: "Activities", comment: "A map label")
    case "spain": Text("Spain", tableName: "Activities", comment: "A map label")
    case "tripleAlliance": Text("Triple Alliance", tableName: "Activities", comment: "A map label")
    case "tripleEntente": Text("Triple Entente", tableName: "Activities", comment: "A map label")
    case "unitedKingdom": Text("United Kingdom", tableName: "Activities", comment: "A map label")
    default: Text(verbatim: text)
    }
  }
}

private let mapPinNumberStyle = TypeStyle.body.weight(.semibold).monospaced()
