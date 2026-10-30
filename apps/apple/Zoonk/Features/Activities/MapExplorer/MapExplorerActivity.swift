import SwiftUI

extension ActivityRenderer {
  static let mapExplorer = ActivityRenderer(template: "mapExplorer", badge: .always(.exploreMap)) {
    context in
    if let fields = try? context.fields(as: MapExplorerFields.self) {
      if let map = context.baseMap {
        MapExplorerCanvas(fields: fields, map: map)
      } else {
        Text(
          "This map can't be shown. Continue to the next screen.", tableName: "Activities",
          comment: "A map activity whose map isn't available"
        )
        .font(.subheadline)
        .foregroundStyle(.secondary)
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

  @State private var selectedId: String?
  @State private var visited: [String] = []
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
                .strokeBorder(.separator)
                .frame(width: 12, height: 12)
            }
          }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .accessibilityHidden(true)
      }

      if let note = MapWords.note(fields.baseMapId) {
        ActivityCaption(note)
      }

      Group {
        if let selected {
          let place = fields.places[selected]

          VStack(alignment: .leading, spacing: 4) {
            Text(
              "\(selected + 1). \(place.label)", tableName: "Activities",
              comment: "A map place's number, then its name"
            )
            .font(.headline)
            LessonRichText(place.reveals)
              .font(.subheadline)
          }
          .accessibilityElement(children: .combine)
        } else {
          Label {
            Text(
              "Tap a numbered place to see what's there.", tableName: "Activities",
              comment: "Before the learner taps a place on a map")
          } icon: {
            Image(systemName: "hand.tap")
          }
          .font(.subheadline)
          .foregroundStyle(.secondary)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(12)
      .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 12))
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
      maxZoom: map.maxZoom, points: points)
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

    ZStack(alignment: .topLeading) {
      MapShapes(
        map: map, crop: crop, scale: scale,
        pins: zip(pins.map(\.spot), shown).map { (spot: $0, shown: $1) }
      )
      .accessibilityElement()
      .accessibilityLabel(textAlternative)

      ForEach(Array(pins.enumerated()), id: \.element.place.id) { order, pin in
        self.pin(pin.place, number: pin.index + 1)
          .position(shown[order])
      }
    }
    .frame(width: width, height: height)
    .background(map.sphere == nil ? ActivityBaseMap.Tone.water : .clear)
    .clipShape(.rect(cornerRadius: 12))
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

      announceActivityChange(LessonRichText.plain(place.reveals))
    } label: {
      Text(number, format: .number)
        .font(.subheadline.weight(.semibold).monospacedDigit())
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
  let map: ActivityBaseMap
  let crop: CGRect
  let scale: Double
  let pins: [(spot: CGPoint, shown: CGPoint)]

  var body: some View {
    Canvas { context, _ in
      let transform = CGAffineTransform(scaleX: scale, y: scale)
        .translatedBy(x: -crop.minX, y: -crop.minY)

      func path(_ data: String) -> Path {
        svg(data).applying(transform)
      }

      if let sphere = map.sphere {
        context.fill(path(sphere), with: .color(ActivityBaseMap.Tone.water))
      }

      for region in map.regions {
        let shape = path(region.path)
        context.fill(shape, with: .color(region.tone.fill))
        context.stroke(
          shape, with: .color(Color(.separator)),
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
          with: .color(Color(.separator)), lineWidth: 1)
      }

      for label in map.labels {
        let point = CGPoint(x: label.x, y: label.y).applying(transform)
        let text = MapWords.label(key: label.key, text: label.text)
          .font(label.kind == .street ? .caption2.weight(.medium) : .caption.weight(.semibold))
        var labelContext = context
        labelContext.translateBy(x: point.x, y: point.y)
        labelContext.rotate(by: .degrees(label.angle))

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
            label.kind == .street ? Color.secondary : Color.primary.opacity(0.75)),
          at: .zero)
      }

      for pin in pins {
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

extension ActivityBaseMap.Tone {
  /// Main's `viz-accent`, the pins' color.
  static var pin: Color { .teal }
  /// Main's `viz-secondary-soft`, the sea around a map.
  static var water: Color { .purple.opacity(0.14) }

  var fill: Color {
    switch self {
    case .context: Color(.secondarySystemBackground)
    case .focus: Color(.systemBackground)
    case .groupA: .teal.opacity(0.22)
    case .groupB: .orange.opacity(0.22)
    case .groupC: .purple.opacity(0.14)
    }
  }
}

/// Mirrors main's `use-base-map-words`.
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
