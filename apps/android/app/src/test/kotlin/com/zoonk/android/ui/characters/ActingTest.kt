package com.zoonk.android.ui.characters

import androidx.compose.ui.geometry.Offset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ActingTest {
    @Test
    fun startsWhereThePartIsDrawnAndLandsOnTheExpressionsPose() {
        val crown = ActTrack(CharacterPart.Crown, listOf(ActKey(4f, ActEase.Out, rotate = -14f)), settle = ActEase.Follow)

        fun rotate(frame: Float) = crown.pose(frame, 10f, from = PartPose(rotate = -7f), to = PartPose(rotate = -18f)).rotate

        assertEquals(-7f, rotate(0f), DELTA)
        assertEquals(-14f, rotate(4f), DELTA)
        assertEquals(-14f + -4f * ActEase.Follow.transform(0.5f), rotate(7f), DELTA)
        assertEquals(-18f, rotate(10f), DELTA)
    }

    @Test
    fun startsAndLandsAtRestWhenNoExpressionPosesThePart() {
        val lid =
            ActTrack(
                CharacterPart.LidLeft,
                listOf(ActKey(1.5f, ActEase.Hold, opacity = 1f), ActKey(3.5f, ActEase.Hold, opacity = 0f)),
                rest = PartPose.Hidden,
            )

        fun opacity(frame: Float) = lid.pose(frame, 6f, lid.rest, lid.rest).opacity

        assertEquals(listOf(0f, 0f, 1f, 1f, 0f, 0f), listOf(0f, 1.4f, 1.5f, 3.4f, 3.5f, 6f).map(::opacity))
    }

    @Test
    fun aKeyAtTheFirstOrLastFrameReplacesThatEnd() {
        val sweat =
            ActTrack(
                CharacterPart.Sweat,
                listOf(ActKey(0f, translate = Offset(0f, -4f)), ActKey(8f, ActEase.Swing, translate = Offset(0f, 2f))),
            )

        assertEquals(Offset(0f, -4f), sweat.pose(0f, 8f, PartPose.Still, PartPose.Still).translate)
        assertEquals(Offset(0f, 2f), sweat.pose(8f, 8f, PartPose.Still, PartPose.Still).translate)
    }

    @Test
    fun whatAKeyDoesntSetEasesFromTheDrawnPoseToTheLanding() {
        val tail = ActTrack(CharacterPart.Tail, emptyList(), settle = ActEase.Follow)

        assertEquals(-5f, tail.pose(0f, 12f, PartPose(rotate = -5f), PartPose.Still).rotate, DELTA)
        assertEquals(0f, tail.pose(12f, 12f, PartPose(rotate = -5f), PartPose.Still).rotate, DELTA)
    }

    @Test
    fun swapsTheFaceAtItsSwapFrame() {
        assertEquals(BuddyExpression.Neutral, BuddyActs.smile.face(3.9f, BuddyExpression.Neutral))
        assertEquals(BuddyExpression.Happy, BuddyActs.smile.face(4f, BuddyExpression.Neutral))
        assertEquals(BuddyExpression.Neutral, BuddyActs.blink.face(5f, BuddyExpression.Neutral))
    }

    @Test
    fun everyActKeepsItsKeysInOrderInsideItsFramesOneTrackAPart() {
        allActs.forEach { (name, act) ->
            assertEquals(name, act.tracks.size, act.tracks.distinctBy { it.part }.size)

            act.tracks.forEach { track ->
                val ats = track.keys.map { it.at }
                assertEquals("$name ${track.part}", ats.sorted(), ats)
                assertTrue("$name ${track.part}", ats.all { it in 0f..act.frames })
            }
        }
    }

    @Test
    fun everySwappingActSwapsIntoTheExpressionItLandsIn() {
        allActs.forEach { (name, act) ->
            val swapAt = act.swapAt ?: return@forEach
            assertNotNull(name, act.to)
            assertTrue(name, swapAt > 0f && swapAt < act.frames)
        }
    }

    @Test
    fun easesRunFromStartToEndAndOnlySpringsOvershoot() {
        ActEase.entries.forEach { ease ->
            assertEquals("$ease", 0f, ease.transform(0f), DELTA)
            assertEquals("$ease", 1f, ease.transform(1f), DELTA)
        }

        val samples = (0..100).map { it / 100f }
        assertTrue(samples.maxOf(ActEase.Spring::transform) > 1f)
        assertTrue(samples.maxOf(ActEase.Follow::transform) > 1.2f)
        assertTrue(samples.all { ActEase.Out.transform(it) <= 1f })
        assertEquals(0f, ActEase.Hold.transform(0.99f), DELTA)
    }

    @Test
    fun timesFramesAtTwentyFourASecond() {
        assertEquals(250, BuddyActs.blink.durationMillis)
        assertEquals(1250, BuddyActs.cheer.durationMillis)
        assertEquals(1750, TricksterActs.defeat.durationMillis)
    }

    private val allActs =
        BuddyAct.entries.map { "Buddy $it" to BuddyActing.act(it) } +
            TricksterAct.entries.map { "Trickster $it" to TricksterActing.act(it) }

    private companion object {
        const val DELTA = 0.001f
    }
}
