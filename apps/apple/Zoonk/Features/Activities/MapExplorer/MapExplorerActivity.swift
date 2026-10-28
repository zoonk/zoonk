import MapKit
import SwiftUI

extension ActivityRenderer {
  static let mapExplorer = ActivityRenderer(template: "mapExplorer") { context in
    if let fields = try? context.fields(as: MapExplorerFields.self) {
      MapExplorerCanvas(fields: fields)
    }
  }
}

struct MapExplorerFields: Decodable, Hashable, Sendable {
  struct Place: Decodable, Hashable, Sendable, Identifiable {
    let id: String
    let label: String
    let latitude: Double
    let longitude: Double
    let reveals: String

    var coordinate: CLLocationCoordinate2D {
      CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
  }

  let baseMapId: String
  let places: [Place]

  /// The part of the map that shows every place with room around it, close enough that places a
  /// street apart get pins of their own.
  var visibleRect: MKMapRect {
    let points = places.map { MKMapPoint($0.coordinate) }
    let bounds = points.reduce(MKMapRect.null) {
      $0.union(MKMapRect(origin: $1, size: MKMapSize()))
    }
    let side = max(
      bounds.width, bounds.height, MKMapPointsPerMeterAtLatitude(places.first?.latitude ?? 0) * 200)
    return bounds.insetBy(dx: -side * 0.35, dy: -side * 0.35)
  }
}

private struct MapExplorerCanvas: View {
  let fields: MapExplorerFields

  @State private var selectedId: String?
  @State private var visited: [String] = []
  @State private var position: MapCameraPosition

  init(fields: MapExplorerFields) {
    self.fields = fields
    _position = State(initialValue: .rect(fields.visibleRect))
  }

  var body: some View {
    let selected = fields.places.firstIndex { $0.id == selectedId }

    VStack(alignment: .leading, spacing: 10) {
      ActivityCaption(
        Text(
          "\(visited.count) of \(fields.places.count) explored", tableName: "Activities",
          comment: "How many places of a map the learner has looked at"))

      Map(position: $position) {
        ForEach(Array(fields.places.enumerated()), id: \.element.id) { index, place in
          Annotation(coordinate: place.coordinate, anchor: .center) {
            pin(place, number: index + 1)
          } label: {
            Text(place.label)
          }
          .annotationTitles(.hidden)
        }
      }
      .mapStyle(.standard(pointsOfInterest: .excludingAll))
      .aspectRatio(4 / 3, contentMode: .fit)
      .frame(maxHeight: 440)
      .clipShape(.rect(cornerRadius: 16))

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
        .font(.subheadline.weight(.bold).monospacedDigit())
        .foregroundStyle(isSelected ? Color(.systemBackground) : .primary)
        .frame(minWidth: 32, minHeight: 32)
        .background(
          isSelected ? Color.primary : isVisited ? Color.mint : Color(.systemBackground),
          in: .circle
        )
        .overlay { Circle().strokeBorder(.primary, lineWidth: 2) }
        .contentShape(.circle.inset(by: -6))
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
