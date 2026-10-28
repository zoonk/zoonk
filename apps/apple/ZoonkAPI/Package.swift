// swift-tools-version: 6.2
import PackageDescription

let package = Package(
  name: "ZoonkAPI",
  platforms: [.iOS(.v26)],
  products: [.library(name: "ZoonkAPI", targets: ["ZoonkAPI"])],
  dependencies: [
    .package(url: "https://github.com/apple/swift-openapi-generator", exact: "1.14.0"),
    .package(url: "https://github.com/apple/swift-openapi-runtime", from: "1.13.0"),
    .package(url: "https://github.com/apple/swift-http-types", from: "1.8.0"),
  ],
  targets: [
    .target(
      name: "ZoonkAPI",
      dependencies: [
        .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
        .product(name: "HTTPTypes", package: "swift-http-types"),
      ],
      plugins: [.plugin(name: "OpenAPIGenerator", package: "swift-openapi-generator")]
    )
  ]
)
