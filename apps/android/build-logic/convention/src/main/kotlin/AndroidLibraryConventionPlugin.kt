import com.android.build.api.dsl.LibraryExtension
import com.zoonk.buildlogic.TARGET_SDK
import com.zoonk.buildlogic.configureAndroid
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.apply
import org.gradle.kotlin.dsl.configure

class AndroidLibraryConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            apply(plugin = "com.android.library")
            extensions.configure<LibraryExtension> {
                configureAndroid(this)
                // A library has no target SDK of its own; lint and tests judge it by the app's.
                lint.targetSdk = TARGET_SDK
                testOptions.targetSdk = TARGET_SDK
            }
        }
    }
}
