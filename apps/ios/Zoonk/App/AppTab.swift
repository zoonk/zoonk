import SwiftUI

enum AppTab: Hashable {
    case home
    case learn
    case progress
    case search

    var title: LocalizedStringKey {
        switch self {
        case .home:
            "Home"
        case .learn:
            "Learn"
        case .progress:
            "Progress"
        case .search:
            "Search"
        }
    }

    var symbolName: String {
        switch self {
        case .home:
            "house"
        case .learn:
            "book"
        case .progress:
            "chart.line.uptrend.xyaxis"
        case .search:
            "magnifyingglass"
        }
    }

    var emptyStateTitle: LocalizedStringKey {
        switch self {
        case .home:
            "Start learning"
        case .learn:
            "Your lessons"
        case .progress:
            "Your progress"
        case .search:
            "Courses"
        }
    }

    var emptyStateDescription: LocalizedStringKey {
        switch self {
        case .home:
            "Your next lesson will appear here."
        case .learn:
            "Lessons and saved courses will appear here."
        case .progress:
            "Your learning activity will appear here."
        case .search:
            "The course list will appear here."
        }
    }
}
