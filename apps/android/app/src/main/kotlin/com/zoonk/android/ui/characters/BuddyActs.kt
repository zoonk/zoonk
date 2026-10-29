package com.zoonk.android.ui.characters

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.ScaleFactor
import com.zoonk.android.ui.characters.ActEase.Accelerate
import com.zoonk.android.ui.characters.ActEase.Follow
import com.zoonk.android.ui.characters.ActEase.Hold
import com.zoonk.android.ui.characters.ActEase.Out
import com.zoonk.android.ui.characters.ActEase.Spring
import com.zoonk.android.ui.characters.ActEase.Swing
import com.zoonk.android.ui.characters.CharacterPart.Antenna
import com.zoonk.android.ui.characters.CharacterPart.AntennaLeft
import com.zoonk.android.ui.characters.CharacterPart.AntennaRight
import com.zoonk.android.ui.characters.CharacterPart.ArmLeft
import com.zoonk.android.ui.characters.CharacterPart.ArmRight
import com.zoonk.android.ui.characters.CharacterPart.Body
import com.zoonk.android.ui.characters.CharacterPart.BrowLeft
import com.zoonk.android.ui.characters.CharacterPart.BrowRight
import com.zoonk.android.ui.characters.CharacterPart.EyeLeft
import com.zoonk.android.ui.characters.CharacterPart.EyeRight
import com.zoonk.android.ui.characters.CharacterPart.Face
import com.zoonk.android.ui.characters.CharacterPart.Head
import com.zoonk.android.ui.characters.CharacterPart.LidLeft
import com.zoonk.android.ui.characters.CharacterPart.LidRight
import com.zoonk.android.ui.characters.CharacterPart.Mouth
import com.zoonk.android.ui.characters.CharacterPart.PupilLeft
import com.zoonk.android.ui.characters.CharacterPart.PupilRight
import com.zoonk.android.ui.characters.CharacterPart.Shadow

/** Which act plays at which moment: `CHARACTER_MOMENTS` in `apps/playground/src/design-system/characters.ts`. */
enum class BuddyAct { Blink, Cheer, Glance, Proud, Smile, Surprise }

internal val BuddyActing =
    CharacterActs(
        act = { name: BuddyAct ->
            when (name) {
                BuddyAct.Blink -> BuddyActs.blink
                BuddyAct.Cheer -> BuddyActs.cheer
                BuddyAct.Glance -> BuddyActs.glance
                BuddyAct.Proud -> BuddyActs.proud
                BuddyAct.Smile -> BuddyActs.smile
                BuddyAct.Surprise -> BuddyActs.surprise
            }
        },
        blink = BuddyAct.Blink,
        openEyes =
            setOf(
                BuddyExpression.Happy,
                BuddyExpression.Kind,
                BuddyExpression.Neutral,
                BuddyExpression.Think,
                BuddyExpression.Wow,
            ),
        expressions = BuddyExpression.entries,
    )

internal object BuddyActs {
    val blink = CharacterAct<BuddyExpression>(frames = 6f, tracks = both(Eyes, blinkEyes(0f)) + both(Lids, blinkLids(0f)))

    val glance =
        CharacterAct<BuddyExpression>(
            frames = 26f,
            tracks =
                both(
                    Pupils,
                    listOf(
                        ActKey(2f, Out, translate = Offset(2.6f, -0.4f)),
                        ActKey(14f, translate = Offset(2.6f, -0.4f)),
                        ActKey(16f, Out, translate = Offset.Zero),
                    ),
                ) + both(Eyes, blinkEyes(15f)) + both(Lids, blinkLids(15f)) +
                    listOf(
                        ActTrack(
                            Face,
                            listOf(
                                ActKey(1f, translate = Offset.Zero),
                                ActKey(8f, Swing, translate = Offset(1.4f, 0f)),
                                ActKey(15f, translate = Offset(1.4f, 0f)),
                            ),
                            settle = Swing,
                        ),
                        ActTrack(
                            Head,
                            listOf(
                                ActKey(1f, rotate = 0f),
                                ActKey(8f, Swing, rotate = 3f),
                                ActKey(15f, rotate = 3f),
                                ActKey(22f, Swing, rotate = 0f),
                            ),
                        ),
                        ActTrack(AntennaLeft, glanceAntenna, settle = Follow),
                        ActTrack(
                            AntennaRight,
                            listOf(
                                ActKey(4f, rotate = 0f),
                                ActKey(9f, Swing, rotate = -3.5f),
                                ActKey(15f, Follow, rotate = 0f),
                                ActKey(20f, Swing, rotate = 2.5f),
                            ),
                            settle = Follow,
                        ),
                        ActTrack(Antenna, glanceAntenna, settle = Follow),
                    ),
        )

    val smile =
        CharacterAct(
            frames = 16f,
            swapAt = 4f,
            to = BuddyExpression.Happy,
            tracks =
                both(Eyes, listOf(ActKey(3f, Swing, scale = ScaleFactor(1f, 0.86f)), ActKey(7f, scale = ScaleFactor(1f, 0.9f))), Spring) +
                    listOf(
                        ActTrack(
                            Mouth,
                            listOf(
                                ActKey(3f, Accelerate, scale = ScaleFactor(1.12f, 0.7f)),
                                ActKey(4f, Hold, scale = ScaleFactor(0.82f, 1.2f)),
                                ActKey(8f, Out, scale = ScaleFactor(1.06f, 0.96f)),
                            ),
                            settle = Spring,
                        ),
                        ActTrack(
                            Head,
                            listOf(ActKey(2f, rotate = 0f), ActKey(7f, Swing, rotate = -2.5f), ActKey(11f, rotate = -2.5f)),
                            settle = Swing,
                        ),
                        ActTrack(Body, listOf(ActKey(6f, Out, scale = ScaleFactor(0.98f, 1.025f))), settle = Spring),
                        ActTrack(AntennaLeft, listOf(ActKey(7f, Out, rotate = -3f)), settle = Follow),
                        ActTrack(AntennaRight, listOf(ActKey(8f, Out, rotate = 2.5f)), settle = Follow),
                        ActTrack(Antenna, listOf(ActKey(7f, Out, rotate = -3f)), settle = Follow),
                    ),
        )

    /** The arms swing one a frame behind the other and not as far, so they never mirror. */
    val cheer =
        CharacterAct(
            frames = 30f,
            swapAt = 4f,
            to = BuddyExpression.Cheer,
            tracks =
                listOf(
                    ActTrack(
                        Body,
                        listOf(
                            ActKey(4f, Accelerate, scale = ScaleFactor(1.06f, 0.88f)),
                            ActKey(8f, Out, scale = ScaleFactor(0.95f, 1.08f)),
                            ActKey(12f, Swing, scale = ScaleFactor(1.03f, 0.97f)),
                            ActKey(16f, Swing, scale = ScaleFactor(0.99f, 1.01f)),
                        ),
                        settle = Spring,
                    ),
                    ActTrack(
                        Shadow,
                        listOf(ActKey(4f, Accelerate, scale = ScaleFactor(1.08f, 1f)), ActKey(8f, Out, scale = ScaleFactor(0.94f, 1f))),
                        settle = Spring,
                    ),
                ) +
                    both(
                        Eyes,
                        listOf(
                            ActKey(3f, Accelerate, scale = ScaleFactor(1f, 0.15f)),
                            ActKey(5f, scale = ScaleFactor(1f, 0.15f)),
                            ActKey(8f, Out, scale = ScaleFactor(1.06f, 1.14f)),
                        ),
                        Spring,
                    ) +
                    listOf(
                        ActTrack(
                            Mouth,
                            listOf(
                                ActKey(3f, Accelerate, scale = ScaleFactor(0.8f, 0.6f)),
                                ActKey(4f, Hold, scale = ScaleFactor(0.5f, 0.3f)),
                                ActKey(8f, Out, scale = ScaleFactor(1.12f, 1.18f)),
                            ),
                            settle = Spring,
                        ),
                        ActTrack(
                            ArmLeft,
                            listOf(
                                ActKey(4f, Accelerate, rotate = -12f),
                                ActKey(9f, Out, rotate = 96f),
                                ActKey(13f, Swing, rotate = 80f),
                                ActKey(17f, Swing, rotate = 90f),
                                ActKey(20f, rotate = 88f),
                            ),
                            settle = Swing,
                        ),
                        ActTrack(
                            ArmRight,
                            listOf(
                                ActKey(5f, Accelerate, rotate = 12f),
                                ActKey(10f, Out, rotate = -88f),
                                ActKey(14f, Swing, rotate = -74f),
                                ActKey(18f, Swing, rotate = -84f),
                                ActKey(21f, rotate = -82f),
                            ),
                            settle = Swing,
                        ),
                        ActTrack(
                            Head,
                            listOf(ActKey(5f, Accelerate, rotate = 0f), ActKey(10f, Out, rotate = -3f), ActKey(18f, Swing, rotate = 2f)),
                            settle = Swing,
                        ),
                        ActTrack(AntennaLeft, listOf(ActKey(4f, Swing, rotate = 6f), ActKey(9f, Out, rotate = -16f)), settle = Follow),
                        ActTrack(AntennaRight, listOf(ActKey(5f, Swing, rotate = -6f), ActKey(10f, Out, rotate = 15f)), settle = Follow),
                        ActTrack(Antenna, listOf(ActKey(4f, Swing, rotate = 5f), ActKey(9f, Out, rotate = -14f)), settle = Follow),
                    ),
        )

    val surprise =
        CharacterAct(
            frames = 22f,
            swapAt = 3f,
            to = BuddyExpression.Wow,
            tracks =
                listOf(
                    ActTrack(
                        Body,
                        listOf(
                            ActKey(2f, Accelerate, scale = ScaleFactor(1.03f, 0.95f)),
                            ActKey(5f, Out, scale = ScaleFactor(0.97f, 1.06f)),
                        ),
                        settle = Spring,
                    ),
                ) +
                    both(
                        Eyes,
                        listOf(
                            ActKey(2f, Accelerate, scale = ScaleFactor(1f, 0.8f)),
                            ActKey(3f, Hold, scale = ScaleFactor(0.9f, 0.85f)),
                            ActKey(6f, Out, scale = ScaleFactor(1.12f, 1.12f)),
                            ActKey(11f, Spring, scale = ScaleFactor(1f, 1f)),
                            ActKey(13f, scale = ScaleFactor(1f, 1f)),
                            ActKey(15f, Accelerate, scale = ScaleFactor(1f, 0.1f)),
                            ActKey(16f, scale = ScaleFactor(1f, 0.1f)),
                            ActKey(19f, Out, scale = ScaleFactor(1f, 1f)),
                        ),
                    ) + both(Lids, blinkLids(13f)) +
                    listOf(
                        ActTrack(
                            Mouth,
                            listOf(ActKey(3f, Hold, scale = ScaleFactor(0.4f, 0.4f)), ActKey(6f, Out, scale = ScaleFactor(1.15f, 1.15f))),
                            settle = Spring,
                        ),
                        ActTrack(Head, listOf(ActKey(5f, Out, rotate = -2.5f)), settle = Swing),
                        ActTrack(ArmLeft, listOf(ActKey(5f, Out, rotate = 22f)), settle = Swing),
                        ActTrack(ArmRight, listOf(ActKey(6f, Out, rotate = -20f)), settle = Swing),
                        ActTrack(AntennaLeft, listOf(ActKey(5f, Out, rotate = -14f)), settle = Follow),
                        ActTrack(AntennaRight, listOf(ActKey(6f, Out, rotate = 13f)), settle = Follow),
                        ActTrack(Antenna, listOf(ActKey(5f, Out, rotate = -12f)), settle = Follow),
                    ),
        )

    val proud =
        CharacterAct(
            frames = 24f,
            swapAt = 5f,
            to = BuddyExpression.Proud,
            tracks =
                both(
                    Eyes,
                    listOf(
                        ActKey(4f, Accelerate, scale = ScaleFactor(1f, 0.15f)),
                        ActKey(6f, scale = ScaleFactor(1f, 0.15f)),
                        ActKey(10f, Out, scale = ScaleFactor(1f, 1f)),
                    ),
                ) +
                    listOf(
                        ActTrack(
                            Head,
                            listOf(ActKey(2f, rotate = 0f), ActKey(10f, Swing, rotate = -4f), ActKey(17f, rotate = -4f)),
                            settle = Swing,
                        ),
                        ActTrack(
                            Face,
                            listOf(
                                ActKey(3f, translate = Offset.Zero),
                                ActKey(10f, Swing, translate = Offset(0f, -1.5f)),
                                ActKey(17f, translate = Offset(0f, -1.5f)),
                            ),
                            settle = Swing,
                        ),
                        ActTrack(Body, listOf(ActKey(9f, Out, scale = ScaleFactor(0.98f, 1.04f))), settle = Spring),
                        ActTrack(
                            BrowLeft,
                            listOf(ActKey(5f, Hold, translate = Offset(0f, 2.5f)), ActKey(11f, Out, translate = Offset(0f, -1.5f))),
                            settle = Spring,
                        ),
                        ActTrack(
                            BrowRight,
                            listOf(ActKey(5f, Hold, translate = Offset(0f, 2.5f)), ActKey(12f, Out, translate = Offset(0f, -1.5f))),
                            settle = Spring,
                        ),
                        ActTrack(
                            Mouth,
                            listOf(ActKey(5f, Hold, scale = ScaleFactor(0.8f, 0.8f)), ActKey(10f, Out, scale = ScaleFactor(1.06f, 1f))),
                            settle = Spring,
                        ),
                        ActTrack(AntennaLeft, listOf(ActKey(10f, Swing, rotate = 5f)), settle = Follow),
                        ActTrack(AntennaRight, listOf(ActKey(11f, Swing, rotate = 4f)), settle = Follow),
                        ActTrack(Antenna, listOf(ActKey(10f, Swing, rotate = 4f)), settle = Follow),
                        ActTrack(ArmLeft, listOf(ActKey(9f, Swing, rotate = -10f)), settle = Swing),
                        ActTrack(ArmRight, listOf(ActKey(10f, Swing, rotate = 9f)), settle = Swing),
                    ),
        )
}

private val glanceAntenna =
    listOf(ActKey(3f, rotate = 0f), ActKey(8f, Swing, rotate = -4f), ActKey(14f, Follow, rotate = 0f), ActKey(19f, Swing, rotate = 3f))

private val Eyes = EyeLeft to EyeRight
private val Pupils = PupilLeft to PupilRight
private val Lids = LidLeft to LidRight

/** Lids close fast and open slower, as people blink (Trutoiu et al., "Modeling and Animating Eye Blinks", 2011). */
private fun blinkEyes(from: Float) =
    listOf(
        ActKey(from, scale = ScaleFactor(1f, 1f)),
        ActKey(from + 2, Accelerate, scale = ScaleFactor(1f, 0.1f)),
        ActKey(from + 3, scale = ScaleFactor(1f, 0.1f)),
        ActKey(from + 6, Out, scale = ScaleFactor(1f, 1f)),
    )

private fun blinkLids(from: Float) = listOf(ActKey(from + 1.6f, Hold, opacity = 1f), ActKey(from + 3.4f, Hold, opacity = 0f))

private fun both(
    parts: Pair<CharacterPart, CharacterPart>,
    keys: List<ActKey>,
    settle: ActEase? = null,
): List<ActTrack> {
    val rest = if (parts == Lids) PartPose.Hidden else PartPose.Still
    return listOf(ActTrack(parts.first, keys, rest, settle), ActTrack(parts.second, keys, rest, settle))
}
