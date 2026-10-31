package com.zoonk.android.feature.activities.music

import android.app.UiModeManager
import android.content.Context
import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.core.content.edit
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.activities.ActivityPhase
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.player.LessonPlayerHarness
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.summaryStep
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Review screenshots of the music activities' keys, rhythm and notation, written only on demand:
 * `./gradlew :app:testDebugUnitTest --tests '*MusicScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class MusicScreenshots {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val tempFolder = TemporaryFolder()

    private val folder = System.getProperty("zoonk.shots").orEmpty()
    private val harness = LessonPlayerHarness(rule) { tempFolder.newFolder() }
    private val context = ApplicationProvider.getApplicationContext<Context>()

    @Before
    fun onlyOnDemand() {
        assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())
        context.getSharedPreferences(DeviceDelayStore.FILE, Context.MODE_PRIVATE).edit(commit = true) {
            putString(DeviceDelayStore.KEY, "skipped")
        }
    }

    private fun moreContrast() = shadowOf(context.getSystemService(UiModeManager::class.java)).setContrast(1f)

    private fun save(name: String) {
        rule.waitForIdle()
        val bitmap = rule.onRoot().captureToImage().asAndroidBitmap()
        File(folder, "$name.png").apply { parentFile?.mkdirs() }.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun play(
        name: String,
        step: LessonStep,
    ) {
        harness.play(listOf(step, summaryStep("end")))
        save(name)
    }

    private fun marks(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        rule.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        MARK_ROWS.forEach { row ->
                            PianoKeyboard(
                                label = "Piano keys",
                                marks = row,
                                nameOf = { NAMES[it % MusicNotes.OCTAVE] },
                                spokenNameOf = { NAMES[it % MusicNotes.OCTAVE] },
                                isPressed = { it in row },
                                onPress = null,
                            )
                        }
                        PianoKeyboard(
                            label = "Piano keys",
                            marks = MARK_ROWS.last(),
                            nameOf = { NAMES[it % MusicNotes.OCTAVE] },
                            spokenNameOf = { NAMES[it % MusicNotes.OCTAVE] },
                            isPressed = { it in MARK_ROWS.last() },
                            onPress = {},
                        )
                    }
                }
            }
        }
        save(name)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun marksPhone() = marks("marks-phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun marksPhoneDark() = marks("marks-phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun marksPhoneDarkMoreContrast() = marks("marks-phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun marksPhoneMoreContrast() = marks("marks-phone-more-contrast", moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h2400dp-xhdpi")
    fun marksPhoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        marks("marks-phone-font200")
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun marksExpandedDark() = marks("marks-expanded-dark", dark = true)

    private fun rhythmResults(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        val fields = RhythmFields("x..x..x...x.x...", rounds = 2, stepsPerBeat = 4, tempo = 90, toleranceMs = 100)
        val taps = fields.tapTimes.zip(TAP_OFFSETS).mapNotNull { (time, offset) -> offset?.let { time + it } }
        rule.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface {
                    rhythmTapperRenderer.canvas(
                        ActivityProps(
                            content = ActivityFixtures.content("rhythmTapper"),
                            answer = rhythmAnswer(taps, deviceDelayMs = null),
                            expected = null,
                            isCorrect = false,
                            phase = ActivityPhase.Checked,
                            isLocked = false,
                            onAnswerChange = {},
                        ),
                    )
                }
            }
        }
        save(name)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun rhythmResultsPhone() = rhythmResults("rhythm-results-phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun rhythmResultsPhoneDark() = rhythmResults("rhythm-results-phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun rhythmResultsPhoneDarkMoreContrast() = rhythmResults("rhythm-results-phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w360dp-h800dp-xxhdpi")
    fun chordPhone() = play("chord-phone", ActivityFixtures.exploreStep("keyboardFretboard.byEarChoice"))

    @Test
    @Config(qualifiers = "w360dp-h800dp-night-xxhdpi")
    fun chordPhoneDark() = play("chord-phone-dark", ActivityFixtures.exploreStep("keyboardFretboard.byEarChoice"))

    @Test
    @Config(qualifiers = "w360dp-h800dp-night-xxhdpi")
    fun chordPhoneDarkMoreContrast() {
        moreContrast()
        play("chord-phone-dark-more-contrast", ActivityFixtures.exploreStep("keyboardFretboard.byEarChoice"))
    }

    @Test
    @Config(qualifiers = "w360dp-h2400dp-xhdpi")
    fun chordPhoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        play("chord-phone-font200", ActivityFixtures.exploreStep("keyboardFretboard.byEarChoice"))
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-night-xhdpi")
    fun keyboardExpandedDark() = play("keyboard-expanded-dark", ActivityFixtures.step("keyboardFretboard"))

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun rhythmPhone() = play("rhythm-phone", ActivityFixtures.step("rhythmTapper"))

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun rhythmPhoneDark() = play("rhythm-phone-dark", ActivityFixtures.step("rhythmTapper"))

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun rhythmPhoneDarkMoreContrast() {
        moreContrast()
        play("rhythm-phone-dark-more-contrast", ActivityFixtures.step("rhythmTapper"))
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun notationPhone() = play("notation-phone", ActivityFixtures.step("notationPlayer"))

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun notationPhoneDark() = play("notation-phone-dark", ActivityFixtures.step("notationPlayer"))

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun notationPhoneDarkMoreContrast() {
        moreContrast()
        play("notation-phone-dark-more-contrast", ActivityFixtures.step("notationPlayer"))
    }
}

/** Each tap's distance from its hit, past the 100 ms tolerance for early and late; null is a miss. */
private val TAP_OFFSETS = listOf(0.0, -150.0, 0.0, 150.0, null, 0.0, 0.0, 150.0, 0.0, -150.0)

private val NAMES = listOf("C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B")

/** Every mark on a white key, then on a black key. */
private val MARK_ROWS =
    listOf(
        mapOf(
            60 to NoteMarkKind.Kept,
            62 to NoteMarkKind.New,
            64 to NoteMarkKind.Heard,
            65 to NoteMarkKind.Correct,
            67 to NoteMarkKind.Missed,
            69 to NoteMarkKind.Removed,
            71 to NoteMarkKind.Wrong,
        ),
        mapOf(
            61 to NoteMarkKind.Kept,
            63 to NoteMarkKind.New,
            66 to NoteMarkKind.Correct,
            68 to NoteMarkKind.Missed,
            70 to NoteMarkKind.Wrong,
        ),
        mapOf(61 to NoteMarkKind.Removed, 63 to NoteMarkKind.Heard, 66 to NoteMarkKind.Kept),
    )
