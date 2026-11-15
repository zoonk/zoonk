package com.zoonk.android.feature.conversation

import androidx.activity.ComponentActivity
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.isRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.HeldRuns
import com.zoonk.android.feature.livecall.LiveCallFailure
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LanguagePracticeCall
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

/**
 * Review screenshots of the practice call's sheet and the call screens at a limit, before and after its day
 * comes: `./gradlew :feature:conversation:testDebugUnitTest --tests '*CallLimitScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class CallLimitScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = PHONE)
    fun phone() = shots("phone")

    @Test
    @Config(qualifiers = PHONE)
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        shots("phone-font200")
    }

    @Test
    @Config(qualifiers = TABLET)
    fun tablet() = shots("tablet")

    private fun shots(size: String) {
        sheet("practice-call-sheet-$size", practiceCall())
        sheet("practice-call-sheet-free-limit-$size", practiceCall(limit = limit("free", later)))
        sheet("practice-call-sheet-guest-limit-$size", practiceCall(limit = """{"availableAt":null,"period":"total","tier":"guest"}"""))
        sheet("practice-call-sheet-lifted-$size", practiceCall(limit = limit("free", Instant.now().minusSeconds(60))))
        screen("call-problem-limit-$size") { problem(Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days, later)) }
        screen(
            "call-problem-lifted-$size",
        ) { problem(Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days, Instant.now().minusSeconds(60))) }
        screen("dropped-call-limit-$size") { dropped(Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days, later)) }
        screen(
            "dropped-call-lifted-$size",
        ) { dropped(Limit.Reached(LimitTier.Free, LimitPeriod.Rolling30Days, Instant.now().minusSeconds(60))) }
    }

    private val later = Instant.now().plus(9, ChronoUnit.DAYS)

    private fun sheet(
        name: String,
        call: LanguagePracticeCall,
    ) {
        compose.setContent {
            ZoonkTheme {
                PracticeConversation(
                    call = call,
                    chapterId = UUID.fromString("00000000-0000-4000-8000-0000000000a1"),
                    goalId = null,
                    start = callStarter(HeldRuns()) { CallStart.Failed },
                    open = {},
                )
            }
        }
        compose.onNodeWithText("Practice a conversation").performClick()
        compose.waitForIdle()
        write(
            name,
            compose
                .onAllNodes(isRoot())
                .onLast()
                .captureRender()
                .asAndroidBitmap(),
        )
    }

    private fun screen(
        name: String,
        content: @Composable () -> Unit,
    ) {
        compose.setContent { ZoonkTheme { content() } }
        compose.waitForIdle()
        write(name, compose.onRoot().captureRender().asAndroidBitmap())
    }

    @Composable
    private fun problem(limit: Limit.Reached) =
        CallProblem(
            CallProblemKind.Failed(LiveCallFailure.Limit, limit),
            title = "Lucía",
            actions = CallProblemActions({}, {}, {}, {}, {}),
        )

    @Composable
    private fun dropped(limit: Limit.Reached) =
        DroppedCallScreen(
            DroppedCall(DroppedReason.Limit, retry = null),
            limit,
            characterName = "Lucía",
            title = "Lucía",
            actions = DroppedCallActions({}, {}, {}, {}, {}, {}),
        )

    private fun write(
        name: String,
        bitmap: android.graphics.Bitmap,
    ) {
        val file = File(folder, "$name.png")
        writeRender(file, bitmap)
        println("Screenshot ${file.path}")
    }
}

private fun limit(
    tier: String,
    availableAt: Instant,
) = """{"availableAt":"$availableAt","period":"rolling30Days","tier":"$tier"}"""

private fun practiceCall(limit: String = "null"): LanguagePracticeCall =
    ApiJson.decodeFromString(
        """
        {"character":{"name":"Lucía","role":"Waiter"},"defaultMinutes":3,"limit":$limit,"minutes":[1,2,3],"paused":false,"plusMinutes":[5]}
        """.trimIndent(),
    )

private const val PHONE = "w411dp-h891dp-xxhdpi"
private const val TABLET = "w1280dp-h800dp-land-xhdpi"
