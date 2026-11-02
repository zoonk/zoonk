import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.artifacts.VersionCatalogsExtension
import org.gradle.kotlin.dsl.apply
import org.gradle.kotlin.dsl.dependencies
import org.gradle.kotlin.dsl.getByType

class AndroidFeatureConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            apply(plugin = "zoonk.android.library")
            apply(plugin = "org.jetbrains.kotlin.plugin.serialization")
            val libs = extensions.getByType<VersionCatalogsExtension>().named("libs")

            fun lib(alias: String) = libs.findLibrary(alias).get()

            dependencies {
                listOf(":core:resources", ":core:navigation", ":core:data", ":core:designsystem", ":core:ui").forEach {
                    "implementation"(project(it))
                }
                "implementation"(platform(lib("androidx-compose-bom")))
                listOf(
                    "androidx-activity-compose",
                    "androidx-annotation",
                    "androidx-compose-material3",
                    "androidx-compose-ui-tooling-preview",
                    "androidx-lifecycle-runtime-compose",
                    "androidx-lifecycle-viewmodel-compose",
                    "androidx-navigation3-runtime",
                    "kotlinx-coroutines-android",
                    "kotlinx-serialization-core",
                ).forEach { "implementation"(lib(it)) }

                "debugImplementation"(lib("androidx-compose-ui-test-manifest"))
                "debugImplementation"(lib("androidx-compose-ui-tooling"))

                "testImplementation"(testFixtures(project(":core:data")))
                "testImplementation"(testFixtures(project(":core:navigation")))
                "testImplementation"(platform(lib("androidx-compose-bom")))
                listOf(
                    "androidx-compose-ui-test-junit4",
                    "androidx-test-ext-junit",
                    "junit",
                    "kotlinx-coroutines-test",
                    "okhttp-mockwebserver3",
                    "robolectric",
                ).forEach { "testImplementation"(lib(it)) }
            }
        }
    }
}
