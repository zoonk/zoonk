package com.zoonk.android.ui.characters

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.SaverScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.MotionDurationScale
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.StateRestorationTester
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.components.Belt
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.GraphicsMode

@RunWith(AndroidJUnit4::class)
class CharacterActorTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private lateinit var state: BuddyActorState

    private fun showBuddy(
        reaction: ActReaction<BuddyAct>?,
        restoration: StateRestorationTester? = null,
    ) {
        compose.mainClock.autoAdvance = false
        val content: @Composable () -> Unit = {
            ZoonkTheme {
                state = rememberBuddyActorState()
                BuddyActor(BuddyLook(energy = 50.0), Modifier.size(96.dp), reaction = reaction, state = state)
            }
        }
        if (restoration == null) compose.setContent(content) else restoration.setContent(content)
        compose.waitForIdle()
    }

    private fun advance(millis: Long) {
        compose.mainClock.advanceTimeBy(millis)
        compose.waitForIdle()
    }

    @Test
    fun aReactionPlaysOnceThenOneBlinkAboutTwoSecondsLater() {
        showBuddy(ActReaction(BuddyAct.Smile))
        advance(FRAME)
        assertSame(BuddyActs.smile, state.playing?.act)

        advance(SMILE)
        assertEquals(BuddyExpression.Happy, state.landed)
        assertNull(state.playing)

        advance(1_800)
        assertNull(state.playing)

        advance(400)
        assertSame(BuddyActs.blink, state.playing?.act)

        advance(400)
        assertNull(state.playing)
        assertEquals(BuddyExpression.Happy, state.landed)
    }

    @Test
    fun theWayBackDrawsTheReactionsLandingWithoutPlayingItAgain() {
        val restoration = StateRestorationTester(compose)
        showBuddy(ActReaction(BuddyAct.Cheer, delayMillis = 5_000), restoration)

        compose.mainClock.autoAdvance = true
        restoration.emulateSavedInstanceStateRestore()
        compose.mainClock.autoAdvance = false
        advance(6_500)

        assertNull(state.playing)
        assertNull(state.landed)
        assertEquals(BuddyExpression.Cheer, state.resting)
    }

    @Test
    fun aNewActStopsTheOneUnderWayAndStartsFromItsLanding() {
        lateinit var scope: CoroutineScope
        compose.mainClock.autoAdvance = false
        compose.setContent {
            scope = rememberCoroutineScope()
            state = rememberBuddyActorState()
            BuddyActor(BuddyLook(energy = 50.0), Modifier.size(96.dp), state = state)
        }
        compose.waitForIdle()

        var surprised: Boolean? = null
        var cheered: Boolean? = null
        scope.launch { surprised = state.play(BuddyAct.Surprise) }
        advance(FRAME * 4)
        scope.launch { cheered = state.play(BuddyAct.Cheer) }
        advance(FRAME)

        assertEquals(false, surprised)
        assertEquals(BuddyExpression.Wow, state.playing?.from)

        advance(CHEER)
        assertEquals(true, cheered)
        assertEquals(BuddyExpression.Cheer, state.landed)
    }

    @Test
    fun anActUnderWayIsSavedAsTheExpressionItLandsIn() {
        lateinit var scope: CoroutineScope
        compose.mainClock.autoAdvance = false
        compose.setContent {
            scope = rememberCoroutineScope()
            state = rememberBuddyActorState()
            BuddyActor(BuddyLook(energy = 50.0), Modifier.size(96.dp), state = state)
        }
        compose.waitForIdle()

        scope.launch { state.play(BuddyAct.Surprise) }
        advance(FRAME * 3)
        val saver = actorStateSaver(BuddyActing)
        val saved = with(saver) { SaverScope { true }.save(state) }

        assertEquals(BuddyExpression.Wow, saved?.let(saver::restore)?.landed)
    }

    @Test
    fun aLabelNamesItForTalkBackAndNoLabelHidesIt() {
        compose.setContent {
            Column {
                Buddy(BuddyLook(), Modifier.size(48.dp), label = "Zu")
                Buddy(BuddyLook(), Modifier.size(48.dp))
                Trickster(Modifier.size(48.dp))
            }
        }

        compose.onNodeWithContentDescription("Zu").assertExists()
        compose.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.ContentDescription)).assertCountEquals(1)
    }

    @Test
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun drawsEveryKindStageFaceAndPairOfGlasses() {
        compose.setContent {
            ZoonkTheme {
                FlowRow(Modifier.testTag(ALL)) {
                    BuddyKind.entries.forEach { kind ->
                        listOf(Belt.White, Belt.Green, Belt.Black).forEach { belt ->
                            listOf(null, 10.0, 95.0).forEach { energy ->
                                Buddy(BuddyLook(kind, belt = belt, energy = energy), Modifier.size(24.dp))
                                Buddy(BuddyLook(kind, belt = belt, energy = energy), Modifier.size(16.dp), crop = BuddyCrop.Face)
                            }
                        }
                        BuddyExpression.entries.forEach { Buddy(BuddyLook(kind), Modifier.size(24.dp), expression = it) }
                        BuddyGlasses.entries.forEach { Buddy(BuddyLook(kind, it), Modifier.size(24.dp)) }
                    }
                    TricksterExpression.entries.forEach { Trickster(Modifier.size(24.dp), it) }
                    TricksterArt(Modifier.size(24.dp))
                }
                Buddy(BuddyLook(belt = Belt.Blue), Modifier.size(48.dp).testTag(ONE))
            }
        }

        compose.onNodeWithTag(ALL).captureToImage()
        val pixels = compose.onNodeWithTag(ONE).captureToImage().toPixelMap()
        val drawn = (0 until pixels.width).sumOf { x -> (0 until pixels.height).count { y -> pixels[x, y].alpha > 0.5f } }

        assertTrue("The buddy covers a good part of its box", drawn > pixels.width * pixels.height / 4)
    }

    private companion object {
        const val FRAME = 16L
        const val SMILE = 700L
        const val CHEER = 1_300L
        const val ALL = "all"
        const val ONE = "one"
    }
}

@RunWith(AndroidJUnit4::class)
class CharacterActorWithAnimationsOffTest {
    @get:Rule
    val compose =
        createAndroidComposeRule<ComponentActivity>(
            effectContext =
                object : MotionDurationScale {
                    override val scaleFactor = 0f
                },
        )

    @Test
    fun aReactionLandsBeforeAnyFrameDraws() {
        lateinit var state: TricksterActorState
        compose.mainClock.autoAdvance = false
        compose.setContent {
            state = rememberTricksterActorState()
            TricksterArt(Modifier.size(96.dp), beaten = true, reacts = true, state = state)
        }
        compose.waitForIdle()

        assertNull(state.playing)
        assertEquals(TricksterExpression.Defeated, state.landed)
    }
}
