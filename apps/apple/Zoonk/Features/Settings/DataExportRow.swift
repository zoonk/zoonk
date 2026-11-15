import SwiftUI
import UniformTypeIdentifiers

struct DataExportRow: View {
  @State private var file: ExportFile?
  @State private var isExporting = false
  @State private var isPreparing = false
  @State private var failed = false

  let title: Text
  /// What Download is called aloud, since the button's own word doesn't say what it downloads.
  let spokenAction: Text
  let filename: String
  let prepare: () async -> Data?

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      AccessibilityStack(spacing: 12, stackedSpacing: 8) {
        ListRow(title)
          .frame(maxWidth: .infinity, alignment: .leading)

        BusyButton(isBusy: isPreparing, icon: .download) {
          Task {
            await download()
          }
        } label: {
          Text("Download", tableName: "Settings", comment: "Downloads a file of the learner's data")
        }
        .buttonStyle(.outline)
        .controlSize(.small)
        .accessibilityLabel(spokenAction)
      }

      if failed {
        FailureLine(
          message: LocalizedStringResource(
            "We couldn't prepare the download. Try again.", table: "Settings")
        )
        .typeStyle(.body)
      }
    }
    .fileExporter(
      isPresented: $isExporting, item: file, contentTypes: [.json], defaultFilename: filename
    ) { _ in
      file = nil
    }
  }

  private func download() async {
    isPreparing = true
    let data = await prepare()
    isPreparing = false
    failed = data == nil

    if let data {
      file = ExportFile(data: data)
      isExporting = true
    }
  }
}

private struct ExportFile: Transferable {
  let data: Data

  static var transferRepresentation: some TransferRepresentation {
    DataRepresentation(exportedContentType: .json) { $0.data }
  }
}
