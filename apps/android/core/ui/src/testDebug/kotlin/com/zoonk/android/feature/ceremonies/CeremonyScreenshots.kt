package com.zoonk.android.feature.ceremonies

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.app.AppContainer
import com.zoonk.android.feature.certificates.CertificateKind
import com.zoonk.android.feature.certificates.CertificateName
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.components.CelebrationScope
import com.zoonk.android.ui.scaffold.unfoldBook
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.Milestone
import kotlinx.datetime.LocalDate
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.util.UUID
import kotlin.time.Clock

/**
 * Review screenshots of each ceremony, on demand: `-Pzoonk.shots=<folder>`. A certificate's moment
 * shows its words and lock without the learner's list, so an issued one's picture stays blank.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class CeremonyScreenshots {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = capture("phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDark() = capture("phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tablet() = capture("tablet")

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun foldUnfolded() = capture("fold", fold = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-night-xhdpi")
    fun foldUnfoldedDark() = capture("fold-dark", dark = true, fold = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun foldUnfoldedLargeFont() {
        RuntimeEnvironment.setFontScale(2f)
        capture("fold-font200", fold = true)
    }

    @Test
    @Config(qualifiers = "w707dp-h823dp-xhdpi")
    fun galaxyFoldUnfolded() = capture("galaxy-fold", fold = true)

    private fun capture(
        name: String,
        dark: Boolean = false,
        fold: Boolean = false,
    ) {
        val app = AppContainer.preview(compose.activity)
        val milestones: List<Pair<String, @Composable () -> Unit>> =
            listOf(
                "belt" to milestone(Milestone.Kind.BELT, "yellow"),
                "stage" to milestone(Milestone.Kind.BUDDY_STAGE, "young"),
                "glasses" to milestone(Milestone.Kind.GLASSES, "star"),
            ).map { (key, milestone) ->
                key to @Composable {
                    MilestoneCeremony(
                        milestone = milestone,
                        buddy = BuddyLook(),
                        buddyName = "Zu",
                        onShown = {},
                        onClose = {},
                        onWearGlasses = { true },
                    )
                }
            } +
                listOf(
                    "certificate-level-locked" to listOf(certificate("beginner", locked = true)),
                    "certificate-level" to listOf(certificate("beginner", locked = false)),
                    "certificate-plan-locked" to listOf(certificate(null, locked = true)),
                    "certificates-two-locked" to listOf(certificate("overview", locked = true), certificate("beginner", locked = true)),
                ).map { (key, awarded) -> key to @Composable { CertificateCeremony(app, awarded, onClose = {}, onSeePlus = {}) } }
        var index by mutableIntStateOf(0)
        compose.setContent {
            ZoonkTheme(darkTheme = dark) {
                CelebrationScope(play = false) {
                    key(index) { milestones[index].second() }
                }
            }
        }
        if (fold) compose.unfoldBook(folds)
        milestones.indices.forEach { shown ->
            index = shown
            compose.waitForIdle()
            write("ceremony-${milestones[shown].first}-$name", compose.onNode(isDialog()).captureRender().asAndroidBitmap())
        }
    }

    private fun certificate(
        courseLevel: String?,
        locked: Boolean,
    ) = CertificateName(
        code = "K7QF2M9XHD4P${courseLevel.orEmpty()}",
        kind = CertificateKind.Course,
        title = "Python for data analysis",
        courseLevel = courseLevel,
        targetLanguage = null,
        level = null,
        completedOn = LocalDate(2026, 11, 3),
        locked = locked,
    )

    private fun milestone(
        kind: Milestone.Kind,
        key: String,
    ) = Milestone(
        beltStartBrainPower = if (kind == Milestone.Kind.BELT) 1000 else null,
        earnedAt = Clock.System.now(),
        id = UUID.randomUUID(),
        key = key,
        kind = kind,
        shownAt = null,
    )

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        println("Screenshot ${file.path}")
    }
}
