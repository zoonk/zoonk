package com.zoonk.android.ui.characters

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.ScaleFactor
import com.zoonk.android.ui.characters.ActEase.Accelerate
import com.zoonk.android.ui.characters.ActEase.Follow
import com.zoonk.android.ui.characters.ActEase.Hold
import com.zoonk.android.ui.characters.ActEase.Out
import com.zoonk.android.ui.characters.ActEase.Spring
import com.zoonk.android.ui.characters.ActEase.Swing
import com.zoonk.android.ui.characters.CharacterPart.ArmLeft
import com.zoonk.android.ui.characters.CharacterPart.ArmRight
import com.zoonk.android.ui.characters.CharacterPart.Body
import com.zoonk.android.ui.characters.CharacterPart.BrowLeft
import com.zoonk.android.ui.characters.CharacterPart.BrowRight
import com.zoonk.android.ui.characters.CharacterPart.Crown
import com.zoonk.android.ui.characters.CharacterPart.EyeLeft
import com.zoonk.android.ui.characters.CharacterPart.EyeRight
import com.zoonk.android.ui.characters.CharacterPart.Mouth
import com.zoonk.android.ui.characters.CharacterPart.Sign
import com.zoonk.android.ui.characters.CharacterPart.Sweat
import com.zoonk.android.ui.characters.CharacterPart.Tail

/** `Sly` brings him back from smug when the learner gets one past him in a duel. */
enum class TricksterAct { Blink, Defeat, Sly, Smug }

internal val TricksterActing =
    CharacterActs(
        act = { name: TricksterAct ->
            when (name) {
                TricksterAct.Blink -> TricksterActs.blink
                TricksterAct.Defeat -> TricksterActs.defeat
                TricksterAct.Sly -> TricksterActs.sly
                TricksterAct.Smug -> TricksterActs.smug
            }
        },
        blink = TricksterAct.Blink,
        openEyes = TricksterExpression.entries.toSet(),
        expressions = TricksterExpression.entries,
    )

internal object TricksterActs {
    private val blinkKeys = listOf(ActKey(2f, Accelerate, scale = ScaleFactor(1f, 0.1f)), ActKey(3f, scale = ScaleFactor(1f, 0.1f)))

    val blink = CharacterAct<TricksterExpression>(frames = 6f, tracks = eyes(blinkKeys))

    val sly =
        CharacterAct(
            frames = 12f,
            swapAt = 2f,
            to = TricksterExpression.Sly,
            tracks =
                eyes(blinkKeys + ActKey(6f, Out, scale = ScaleFactor(1f, 1f))) +
                    listOf(ActTrack(Crown, emptyList(), settle = Follow), ActTrack(Tail, emptyList(), settle = Follow)),
        )

    private val chuckleLeftArm =
        listOf(ActKey(6f, Swing, rotate = 13f), ActKey(9f, Swing, rotate = -4f), ActKey(12f, Swing, rotate = 10f))

    val smug =
        CharacterAct(
            frames = 22f,
            swapAt = 4f,
            to = TricksterExpression.Smug,
            tracks =
                eyes(listOf(ActKey(3f, Accelerate, scale = ScaleFactor(1f, 0.7f)), ActKey(4f, scale = ScaleFactor(1f, 0.7f))), Out) +
                    listOf(
                        ActTrack(BrowRight, listOf(ActKey(7f, Out, rotate = -9f, translate = Offset(0f, -4.5f))), settle = Spring),
                        ActTrack(BrowLeft, listOf(ActKey(7f, Out, translate = Offset(0f, 1f))), settle = Spring),
                        ActTrack(
                            Mouth,
                            listOf(ActKey(4f, Hold, scale = ScaleFactor(0.9f, 0.9f)), ActKey(8f, Out, scale = ScaleFactor(1.08f, 1.05f))),
                            settle = Spring,
                        ),
                        ActTrack(
                            Body,
                            listOf(
                                ActKey(6f, Swing, scale = ScaleFactor(1.04f, 0.94f)),
                                ActKey(9f, Swing, scale = ScaleFactor(0.985f, 1.035f)),
                                ActKey(12f, Swing, scale = ScaleFactor(1.03f, 0.955f)),
                                ActKey(15f, Swing, scale = ScaleFactor(0.995f, 1.01f)),
                            ),
                            settle = Spring,
                        ),
                        ActTrack(ArmLeft, chuckleLeftArm, settle = Swing),
                        ActTrack(Sign, chuckleLeftArm, settle = Swing),
                        ActTrack(
                            ArmRight,
                            listOf(ActKey(7f, Swing, rotate = -11f), ActKey(10f, Swing, rotate = 3f), ActKey(13f, Swing, rotate = -8f)),
                            settle = Swing,
                        ),
                        ActTrack(Crown, listOf(ActKey(8f, Out, rotate = -17f)), settle = Follow),
                        ActTrack(Tail, listOf(ActKey(5f, Swing, rotate = 6f), ActKey(10f, Out, rotate = -15f)), settle = Follow),
                    ),
        )

    val defeat =
        CharacterAct(
            frames = 42f,
            swapAt = 10f,
            to = TricksterExpression.Defeated,
            tracks =
                listOf(
                    ActTrack(
                        Body,
                        listOf(
                            ActKey(4f, Out, rotate = -1.5f, scale = ScaleFactor(0.95f, 1.08f)),
                            ActKey(9f, rotate = -1.5f, scale = ScaleFactor(0.96f, 1.065f)),
                            ActKey(20f, Swing, rotate = 6f, scale = ScaleFactor(1.05f, 0.91f)),
                            ActKey(27f, Spring, rotate = 5f, scale = ScaleFactor(1.03f, 0.95f)),
                            ActKey(32f, Swing, rotate = 5f, scale = ScaleFactor(1.04f, 0.935f)),
                            ActKey(38f, Swing, rotate = 5f, scale = ScaleFactor(1.03f, 0.95f)),
                        ),
                        settle = Swing,
                    ),
                ) +
                    eyes(
                        listOf(
                            ActKey(4f, Out, scale = ScaleFactor(1.2f, 1.2f)),
                            ActKey(8f, scale = ScaleFactor(1.15f, 1.15f)),
                            ActKey(10f, Accelerate, scale = ScaleFactor(1f, 0.12f)),
                            ActKey(13f, scale = ScaleFactor(1f, 0.12f)),
                            ActKey(21f, Swing, scale = ScaleFactor(1f, 1f)),
                        ),
                        Out,
                    ) +
                    listOf(
                        ActTrack(
                            BrowLeft,
                            listOf(
                                ActKey(4f, Out, translate = Offset(0f, -4.5f)),
                                ActKey(9f, translate = Offset(0f, -4f)),
                                ActKey(10f, Hold, translate = Offset(0f, -1f)),
                                ActKey(22f, Swing, translate = Offset(0f, 0.5f)),
                            ),
                            settle = Spring,
                        ),
                        ActTrack(
                            BrowRight,
                            listOf(
                                ActKey(4f, Out, translate = Offset(0f, -5f)),
                                ActKey(9f, translate = Offset(0f, -4.5f)),
                                ActKey(10f, Hold, translate = Offset(0f, -1f)),
                                ActKey(22f, Swing, translate = Offset(0f, 0.5f)),
                            ),
                            settle = Spring,
                        ),
                        ActTrack(
                            Mouth,
                            listOf(
                                ActKey(4f, Out, scale = ScaleFactor(0.85f, 1.2f)),
                                ActKey(10f, Hold, scale = ScaleFactor(0.6f, 0.6f)),
                                ActKey(19f, Swing, scale = ScaleFactor(1.05f, 1.1f)),
                            ),
                            settle = Spring,
                        ),
                        ActTrack(
                            ArmLeft,
                            listOf(ActKey(4f, Out, rotate = 14f), ActKey(12f, rotate = 10f), ActKey(22f, Swing, rotate = -28f)),
                            settle = Spring,
                        ),
                        ActTrack(
                            ArmRight,
                            listOf(ActKey(5f, Out, rotate = -14f), ActKey(13f, rotate = -10f), ActKey(24f, Swing, rotate = 28f)),
                            settle = Spring,
                        ),
                        ActTrack(
                            Tail,
                            listOf(ActKey(4f, Out, rotate = -10f), ActKey(14f, Swing, rotate = -5f), ActKey(26f, Swing, rotate = 22f)),
                            settle = Follow,
                        ),
                        ActTrack(
                            Crown,
                            listOf(
                                ActKey(4f, Out, rotate = -14f, translate = Offset(0f, -4f)),
                                ActKey(12f, Swing, rotate = -11f, translate = Offset(0f, -2f)),
                                ActKey(27f, Accelerate, rotate = -24f, translate = Offset(-4f, 10f)),
                            ),
                            settle = Follow,
                        ),
                        ActTrack(
                            Sweat,
                            listOf(
                                ActKey(0f, opacity = 0f, translate = Offset(0f, -4f)),
                                ActKey(28f, opacity = 0f, translate = Offset(0f, -4f)),
                                ActKey(31f, Out, opacity = 1f),
                            ),
                            settle = Swing,
                        ),
                    ),
        )
}

private fun eyes(
    keys: List<ActKey>,
    settle: ActEase? = null,
): List<ActTrack> = listOf(ActTrack(EyeLeft, keys, settle = settle), ActTrack(EyeRight, keys, settle = settle))
