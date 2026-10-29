package com.zoonk.android.ui.characters

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.layout.ScaleFactor

enum class TricksterExpression { Sly, Smug, Defeated }

/** Main's `@zoonk/ui` Trickster, path for path; artwork colors, the same in light and dark. */
internal class TricksterDrawing(
    private val holdsSign: Boolean,
) : CharacterDrawing<TricksterExpression> {
    override val viewBox = Rect(0f, 0f, 160f, 160f)

    override fun pose(
        expression: TricksterExpression,
        part: CharacterPart,
    ): PartPose? =
        when (expression) {
            TricksterExpression.Sly -> {
                null
            }

            TricksterExpression.Smug -> {
                when (part) {
                    CharacterPart.Crown -> PartPose(rotate = -7f)
                    CharacterPart.Tail -> PartPose(rotate = -5f)
                    else -> null
                }
            }

            TricksterExpression.Defeated -> {
                when (part) {
                    CharacterPart.ArmLeft -> PartPose(rotate = -22f)
                    CharacterPart.ArmRight -> PartPose(rotate = 22f)
                    CharacterPart.Body -> PartPose(rotate = 5f, scale = ScaleFactor(1.03f, 0.95f))
                    CharacterPart.Crown -> PartPose(rotate = -18f, translate = Offset(-3f, 8f))
                    CharacterPart.Tail -> PartPose(rotate = 16f)
                    else -> null
                }
            }
        }

    override fun ArtPainter.draw(face: TricksterExpression) {
        part(CharacterPart.Shadow, Offset(72f, 150f)) { fill(TricksterShapes.shadow, Color.Black, alpha = 0.22f) }
        part(CharacterPart.Body, Offset(72f, 142f)) {
            part(CharacterPart.ArmLeft, Offset(46f, 116f)) { fill(TricksterShapes.armLeft, Violet) }
            part(CharacterPart.ArmRight, Offset(98f, 116f)) { fill(TricksterShapes.armRight, Violet) }
            part(CharacterPart.Head, Offset(72f, 140f)) {
                part(CharacterPart.Tail, Offset(86f, 88f)) {
                    fill(TricksterShapes.tail, TricksterShapes.tailFill)
                    fill(TricksterShapes.tailEnd, TricksterShapes.tailFill)
                    stroke(TricksterShapes.tailStem, TricksterShapes.tailFill, 13.5f, cap = StrokeCap.Round)
                    stroke(TricksterShapes.tailShine, Color.White, 2.2f, alpha = 0.55f, cap = StrokeCap.Round)
                }
                fill(TricksterShapes.head, TricksterShapes.skin)
                fill(TricksterShapes.shine, Color.White, alpha = 0.45f)
                fill(TricksterShapes.glint, Color.White, alpha = 0.35f)
                if (holdsSign) questionSign()
                part(CharacterPart.Face, Offset(70f, 104f)) { tricksterFace(face) }
                part(CharacterPart.Crown, Offset(51f, 66f)) {
                    group(transform = {
                        rotate(-20f, Offset(51f, 66f))
                        translate(36f, 55f)
                        scale(0.75f, 0.75f, Offset.Zero)
                    }) {
                        fill(CrownShapes.shape, CrownShapes.gold)
                        stroke(CrownShapes.shape, CrownShapes.edge, 1.8f, join = StrokeJoin.Round)
                        fill(CrownShapes.band, Color(0xFFF7C24A))
                        stroke(CrownShapes.band, CrownShapes.edge, 1.6f)
                        CrownShapes.aquamarines.forEach { fill(it, Color(0xFF7CF5FF)) }
                        CrownShapes.rubies.forEach { fill(it, Color(0xFFFF7AC6)) }
                    }
                }
            }
        }
    }

    private fun ArtPainter.questionSign() {
        part(CharacterPart.Sign, Offset(46f, 116f)) {
            group(transform = { rotate(-14f, Offset(30f, 120f)) }) {
                stroke(SignShapes.post, SignShapes.lilac, 3f, cap = StrokeCap.Round)
                fill(SignShapes.board, Color(0xFFFBFAFF))
                stroke(SignShapes.board, SignShapes.lilac, 1.8f)
                stroke(SignShapes.question, Violet, 2.6f, cap = StrokeCap.Round)
                fill(SignShapes.dot, Violet)
            }
            fill(SignShapes.hand, Violet)
        }
    }

    private fun ArtPainter.tricksterFace(face: TricksterExpression) {
        val look = Looks.getValue(face)

        part(CharacterPart.Mask, Offset(70f, 102f)) { fill(TricksterShapes.mask, Ink) }
        maskEye(CharacterPart.EyeLeft, CharacterPart.PupilLeft, look.left)
        maskEye(CharacterPart.EyeRight, CharacterPart.PupilRight, look.right)
        part(CharacterPart.BrowLeft, Offset(54f, 88f)) { stroke(look.browLeft, Ink, 3.2f, cap = StrokeCap.Round) }
        part(CharacterPart.BrowRight, Offset(83f, 81f)) { stroke(look.browRight, Ink, 3.2f, cap = StrokeCap.Round) }

        when (val mouth = look.mouth) {
            is TricksterMouth.Grin -> {
                part(CharacterPart.Mouth, Offset(70f, 120f)) {
                    fill(mouth.grin, Ink)
                    stroke(mouth.grin, Ink, 2f, join = StrokeJoin.Round)
                    fill(mouth.fang, Color.White)
                    stroke(mouth.cheek, Ink, 2.4f, cap = StrokeCap.Round)
                }
            }

            is TricksterMouth.Wobble -> {
                part(CharacterPart.Mouth, Offset(70f, 121f)) {
                    stroke(mouth.line, Ink, 3f, cap = StrokeCap.Round, join = StrokeJoin.Round)
                }
                part(CharacterPart.Sweat, Offset(104f, 84f)) {
                    fill(TricksterShapes.sweat, Color(0xFFA8DDFF))
                    fill(TricksterShapes.sweatGlint, Color.White, alpha = 0.8f)
                }
            }
        }
    }

    private fun ArtPainter.maskEye(
        part: CharacterPart,
        pupilPart: CharacterPart,
        eye: MaskEye,
    ) {
        part(part, eye.pivot) {
            clip(eye.lidClip) { fill(eye.white, Color.White) }
            eye.lid?.let { stroke(it, Ink, 2.6f, cap = StrokeCap.Round) }
            part(pupilPart, eye.pupilPivot) {
                fill(eye.pupil, Pupil)
                fill(eye.glint, Color.White)
            }
        }
    }
}

/** Where the lid clips the eye's white: lower for a smug or beaten look. */
private class MaskEye(
    white: FloatArray,
    pupil: FloatArray,
    glint: FloatArray,
    lidClip: String,
    lid: String?,
) {
    val pivot = Offset(white[0], white[1])
    val white = ellipse(white[0], white[1], white[2], white[3])
    val pupilPivot = Offset(pupil[0], pupil[1])
    val pupil = circle(pupil[0], pupil[1], pupil[2])
    val glint = circle(glint[0], glint[1], glint[2])
    val lidClip = svg(lidClip)
    val lid = lid?.let(::svg)
}

private sealed interface TricksterMouth {
    class Grin(
        grin: String,
        fang: String,
        cheek: String,
    ) : TricksterMouth {
        val grin = svg(grin)
        val fang = svg(fang)
        val cheek = svg(cheek)
    }

    class Wobble(
        line: String,
    ) : TricksterMouth {
        val line = svg(line)
    }
}

private class FaceLook(
    val left: MaskEye,
    val right: MaskEye,
    browLeft: String,
    browRight: String,
    val mouth: TricksterMouth,
) {
    val browLeft = svg(browLeft)
    val browRight = svg(browRight)
}

private val LeftWhite = floatArrayOf(56f, 103f, 7.6f, 8f)
private val RightWhite = floatArrayOf(82f, 101f, 7.6f, 8.2f)

private val Looks: Map<TricksterExpression, FaceLook> =
    mapOf(
        TricksterExpression.Sly to
            FaceLook(
                left =
                    MaskEye(
                        LeftWhite,
                        floatArrayOf(53.4f, 104.6f, 4f),
                        floatArrayOf(54.8f, 103.3f, 1.3f),
                        "M40 100.6 L70 98.2 L70 120 L40 120 Z",
                        "M48.2 100.2 L63.8 99",
                    ),
                right =
                    MaskEye(
                        RightWhite,
                        floatArrayOf(79.4f, 102.6f, 4.2f),
                        floatArrayOf(80.9f, 101.2f, 1.4f),
                        "M70 95.4 L96 93.6 L96 118 L70 118 Z",
                        lid = null,
                    ),
                browLeft = "M46 88 Q54 86.5 62 89.5",
                browRight = "M74 84 Q82 75.5 92 81",
                mouth =
                    TricksterMouth.Grin(
                        grin = "M52 119 Q68 132 90 114 Q71 124.5 52 119 Z",
                        fang = "M59.5 122.6 L62 128 L65 123.6 Z",
                        cheek = "M88 111.5 Q92 111 93 108",
                    ),
            ),
        TricksterExpression.Smug to
            FaceLook(
                left =
                    MaskEye(
                        LeftWhite,
                        floatArrayOf(57f, 105f, 4f),
                        floatArrayOf(58.4f, 103.6f, 1.3f),
                        "M40 102.6 L70 100.4 L70 120 L40 120 Z",
                        "M48.2 102.2 L63.8 101.2",
                    ),
                right =
                    MaskEye(
                        RightWhite,
                        floatArrayOf(83f, 103f, 4.2f),
                        floatArrayOf(84.5f, 101.6f, 1.4f),
                        "M70 98 L96 96.4 L96 118 L70 118 Z",
                        "M74.5 97.6 L89.5 96.6",
                    ),
                browLeft = "M46 89.5 Q54 88.5 62 91",
                browRight = "M74 82.5 Q82 72.5 92 79",
                mouth =
                    TricksterMouth.Grin(
                        grin = "M50 118.5 Q68 133.5 92.5 111.5 Q71 125.5 50 118.5 Z",
                        fang = "M58.5 122.4 L61 128 L64 123.4 Z",
                        cheek = "M90.5 109.5 Q94.5 109 95.5 105.5",
                    ),
            ),
        TricksterExpression.Defeated to
            FaceLook(
                left =
                    MaskEye(
                        LeftWhite,
                        floatArrayOf(55f, 107.5f, 4f),
                        floatArrayOf(56.4f, 106.3f, 1.3f),
                        "M40 104.6 L70 100.4 L70 120 L40 120 Z",
                        "M47.6 103.7 L63.6 101.5",
                    ),
                right =
                    MaskEye(
                        RightWhite,
                        floatArrayOf(81f, 106f, 4.2f),
                        floatArrayOf(82.4f, 104.8f, 1.4f),
                        "M70 96.2 L96 100.6 L96 118 L70 118 Z",
                        "M74.6 97.4 L89.6 99.9",
                    ),
                browLeft = "M45 92.5 Q53 89.5 61.5 85.5",
                browRight = "M75 82 Q83 82.5 92 87.5",
                mouth = TricksterMouth.Wobble("M56 123.5 Q60.5 119 65 122 Q70 125.5 75 121.5 Q80 118 85.5 122.5"),
            ),
    )

private object TricksterShapes {
    val shadow = ellipse(72f, 150f, 26f, 4f)
    val armLeft = ellipse(38f, 124f, 6.5f, 8.5f).rotated(38f, 38f, 124f)
    val armRight = ellipse(106f, 124f, 6.5f, 8.5f).rotated(-38f, 106f, 124f)
    val tail = svg("M73 34 A27 27 0 1 1 109.23 59.37 L102.51 47.67 A17 17 0 1 0 79.7 31.7 Z")
    val tailEnd = circle(76.35f, 32.85f, 3.55f)
    val tailStem = svg("M105.9 53.5 C94.6 57.6 86 68 82 90")
    val tailShine = svg("M78 27 A24 24 0 0 1 112.5 13.4")
    val tailFill =
        Brush.linearGradient(
            0f to Color(0xFF8B5CF6),
            0.45f to Color(0xFFC084FC),
            0.8f to Color(0xFFFF9AD5),
            1f to Color(0xFFFFD1EC),
            start = Offset(86f, 92f),
            end = Offset(92f, 8f),
        )
    val head = circle(72f, 106f, 36f)
    val skin =
        radialIn(
            head,
            Offset(0.34f, 0.28f),
            0.8f,
            0f to Color(0xFFF3E9FF),
            0.3f to Color(0xFFC9AAFF),
            0.72f to Color(0xFF8B5CF6),
            1f to Color(0xFF4C1D95),
        )
    val shine = ellipse(58f, 84f, 11f, 6f).rotated(-28f, 58f, 84f)
    val glint = circle(93f, 92f, 2f)
    val mask =
        svg(
            "M41 99 Q47 90 60 94 Q67 96.5 72 94 Q86 86 98 92 Q100 104 91 110 Q80 114.5 72.5 106.5 " +
                "Q68.5 103.5 64.5 106.5 Q54 115 45 110 Q39 105 41 99 Z",
        )
    val sweat = svg("M104 77 Q99.2 84.4 101.4 87 Q104 89.4 106.6 87 Q108.8 84.4 104 77 Z")
    val sweatGlint = circle(102.6f, 85.2f, 1f)
}

private object CrownShapes {
    val edge = Color(0xFFC7861C)
    val shape = svg("M5 25 L3 8 L12.5 16 L20 3.5 L27.5 16 L37 8 L35 25 Z")
    val gold: Brush = linearIn(shape, Offset(0f, 0f), Offset(0f, 1f), 0f to Color(0xFFFFF0B8), 1f to Color(0xFFF5B52E))
    val band = rect(4.5f, 21.5f, 31f, 6f, 2f)
    val aquamarines = listOf(circle(3f, 8f, 2.6f), circle(37f, 8f, 2.6f))
    val rubies = listOf(circle(20f, 3.5f, 3f), circle(20f, 24.5f, 2f))
}

private object SignShapes {
    val lilac = Color(0xFFC4B5FD)
    val post: Path = svg("M30 124 V104")
    val board = circle(30f, 96f, 13f)
    val question = svg("M25.5 92.5 C25.5 86.5 34.5 86.5 34.5 92 C34.5 95.5 30 96 30 99.5")
    val dot = circle(30f, 103.5f, 1.6f)
    val hand = ellipse(34f, 121f, 6.5f, 7f)
}

private val Ink = Color(0xFF2A1260)
private val Pupil = Color(0xFF16123A)
private val Violet = Color(0xFF7C3AED)
