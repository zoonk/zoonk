pluginManagement {
    includeBuild("build-logic")
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "ZoonkAndroid"

include(":app", ":api", ":lint-checks")
include(":core:data", ":core:designsystem", ":core:navigation", ":core:resources", ":core:ui")
