package com.zoonk.android.ui.characters

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Matrix
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin

/** Every face has its eyes at x 44 and 76, y 58, and its mouth near y 80, so every pair of glasses fits it. */
internal fun ArtPainter.drawBuddyFace(expression: BuddyExpression) {
    when (expression) {
        BuddyExpression.Neutral -> {
            openEyes(Faces.eyeLeft, Faces.eyeRight)
            lineMouth(Faces.neutralMouth)
        }

        BuddyExpression.Happy -> {
            openEyes(Faces.eyeLeft, Faces.eyeRight)
            lineMouth(Faces.happyMouth)
        }

        BuddyExpression.Cheer -> {
            arcEyes(Faces.cheerEyeLeft, Faces.cheerEyeRight, 3.4f)
            part(CharacterPart.Mouth, MouthPivot) {
                fill(Faces.cheerMouth, Ink)
                fill(Faces.cheerTongue, Color(0xFFFF7AB6))
            }
        }

        BuddyExpression.Proud -> {
            arcEyes(Faces.proudEyeLeft, Faces.proudEyeRight, 3.2f)
            brows(Faces.proudBrowLeft, Faces.proudBrowRight)
            lineMouth(Faces.proudMouth)
        }

        BuddyExpression.Wow -> {
            openEyes(Faces.wowEyeLeft, Faces.wowEyeRight)
            part(CharacterPart.Mouth, MouthPivot) { fill(Faces.wowMouth, Ink) }
        }

        BuddyExpression.Think -> {
            openEyes(Faces.thinkEyeLeft, Faces.thinkEyeRight)
            lineMouth(Faces.thinkMouth)
        }

        BuddyExpression.Kind -> {
            openEyes(Faces.eyeLeft, Faces.eyeRight)
            brows(Faces.kindBrowLeft, Faces.kindBrowRight)
            lineMouth(Faces.kindMouth)
        }

        BuddyExpression.Sleepy -> {
            part(CharacterPart.EyeLeft, EyePivotLeft) { stroke(Faces.sleepyEyeLeft, Pupil, 3.2f, cap = StrokeCap.Round) }
            part(CharacterPart.EyeRight, EyePivotRight) { stroke(Faces.sleepyEyeRight, Pupil, 3.2f, cap = StrokeCap.Round) }
            part(CharacterPart.Mouth, MouthPivot) { fill(Faces.sleepyMouth, Ink) }
            part(CharacterPart.Snore, Offset(104f, 20f)) {
                stroke(Faces.snoreBig, Color(0xFF8B93C9), 2.6f, cap = StrokeCap.Round, join = StrokeJoin.Round)
                stroke(Faces.snoreSmall, Color(0xFFB3B9DD), 2f, cap = StrokeCap.Round, join = StrokeJoin.Round)
            }
        }
    }
}

internal fun ArtPainter.drawGlasses(glasses: BuddyGlasses) {
    when (glasses) {
        BuddyGlasses.Round -> roundGlasses()
        BuddyGlasses.Star -> starGlasses()
        BuddyGlasses.Aviator -> aviatorGlasses()
        BuddyGlasses.CatEye -> catEyeGlasses()
        BuddyGlasses.Retro -> retroGlasses()
        BuddyGlasses.Monocle -> monocleGlasses()
    }
}

internal const val SLEEPY_EYES_OFFSET = 3f

private class OpenEye(
    val part: CharacterPart,
    val pupilPart: CharacterPart,
    white: FloatArray,
    pupil: FloatArray,
    glint: FloatArray,
) {
    val pivot = if (part == CharacterPart.EyeLeft) EyePivotLeft else EyePivotRight
    val white = ellipse(white[0], white[1], white[2], white[3])
    val pupilPivot = Offset(pupil[0], pupil[1])
    val pupil = circle(pupil[0], pupil[1], pupil[2])
    val glint = circle(glint[0], glint[1], glint[2])
}

private fun ArtPainter.openEyes(
    left: OpenEye,
    right: OpenEye,
) {
    openEye(left)
    openEye(right)
    part(CharacterPart.LidLeft, EyePivotLeft) { stroke(Faces.lidLeft, Pupil, 3.2f, cap = StrokeCap.Round) }
    part(CharacterPart.LidRight, EyePivotRight) { stroke(Faces.lidRight, Pupil, 3.2f, cap = StrokeCap.Round) }
}

private fun ArtPainter.openEye(eye: OpenEye) {
    part(eye.part, eye.pivot) {
        fill(eye.white, Color.White)
        part(eye.pupilPart, eye.pupilPivot) {
            fill(eye.pupil, Pupil)
            fill(eye.glint, Color.White)
        }
    }
}

private fun ArtPainter.arcEyes(
    left: Path,
    right: Path,
    width: Float,
) {
    part(CharacterPart.EyeLeft, EyePivotLeft) { stroke(left, Pupil, width, cap = StrokeCap.Round) }
    part(CharacterPart.EyeRight, EyePivotRight) { stroke(right, Pupil, width, cap = StrokeCap.Round) }
}

private fun ArtPainter.lineMouth(path: Path) {
    part(CharacterPart.Mouth, MouthPivot) { stroke(path, Ink, 3f, cap = StrokeCap.Round) }
}

private fun ArtPainter.brows(
    left: Path,
    right: Path,
) {
    part(CharacterPart.BrowLeft, Offset(42f, 38f)) { stroke(left, Ink, 3f, alpha = 0.5f, cap = StrokeCap.Round) }
    part(CharacterPart.BrowRight, Offset(78f, 38f)) { stroke(right, Ink, 3f, alpha = 0.5f, cap = StrokeCap.Round) }
}

private object Faces {
    val eyeLeft = eye(CharacterPart.EyeLeft, white(44f, 58f, 8.5f, 9.5f), dot(45f, 60f, 5.4f), dot(47f, 57.5f, 1.9f))
    val eyeRight = eye(CharacterPart.EyeRight, white(76f, 58f, 8.5f, 9.5f), dot(77f, 60f, 5.4f), dot(79f, 57.5f, 1.9f))
    val wowEyeLeft = eye(CharacterPart.EyeLeft, white(44f, 58f, 9.5f, 10.5f), dot(44f, 58f, 4f), dot(45.5f, 56.5f, 1.4f))
    val wowEyeRight = eye(CharacterPart.EyeRight, white(76f, 58f, 9.5f, 10.5f), dot(76f, 58f, 4f), dot(77.5f, 56.5f, 1.4f))
    val thinkEyeLeft = eye(CharacterPart.EyeLeft, white(44f, 58f, 8.5f, 9.5f), dot(47.5f, 55f, 5.2f), dot(49f, 53f, 1.7f))
    val thinkEyeRight = eye(CharacterPart.EyeRight, white(76f, 58f, 8.5f, 9.5f), dot(79.5f, 55f, 5.2f), dot(81f, 53f, 1.7f))
    val lidLeft = svg("M36 61 Q44 64 52 61")
    val lidRight = svg("M68 61 Q76 64 84 61")
    val cheerEyeLeft = svg("M37 60 Q44 51 51 60")
    val cheerEyeRight = svg("M69 60 Q76 51 83 60")
    val proudEyeLeft = svg("M37.5 59.5 Q44 54 50.5 59.5")
    val proudEyeRight = svg("M69.5 59.5 Q76 54 82.5 59.5")
    val sleepyEyeLeft = svg("M37 58 Q44 63 51 58").apply { translate(Offset(0f, SLEEPY_EYES_OFFSET)) }
    val sleepyEyeRight = svg("M69 58 Q76 63 83 58").apply { translate(Offset(0f, SLEEPY_EYES_OFFSET)) }
    val proudBrowLeft = svg("M35 40.5 Q42 35.5 50 37.5")
    val proudBrowRight = svg("M85 40.5 Q78 35.5 70 37.5")
    val kindBrowLeft = svg("M34 40 Q41 36 50 38")
    val kindBrowRight = svg("M86 40 Q79 36 70 38")
    val neutralMouth = svg("M55.5 81 Q60 82.6 64.5 81")
    val happyMouth = svg("M54 79 Q60 85 66 79")
    val cheerMouth = svg("M52 77 Q60 90 68 77 Z")
    val cheerTongue = svg("M55.5 81 Q60 85 64.5 81")
    val proudMouth = svg("M52.5 79.5 Q60 86.5 68 78")
    val wowMouth = ellipse(60f, 81f, 4.2f, 5f)
    val thinkMouth = svg("M55 81 Q60 79.5 66 81")
    val kindMouth = svg("M55 80 Q60 83.5 65 80")
    val sleepyMouth = ellipse(60f, 82f, 3.4f, 2.6f)
    val snoreBig = svg("M96 20 h8 l-8 10 h8")
    val snoreSmall = svg("M106 9 h6 l-6 7.5 h6")

    private fun eye(
        part: CharacterPart,
        white: FloatArray,
        pupil: FloatArray,
        glint: FloatArray,
    ) = OpenEye(
        part,
        if (part == CharacterPart.EyeLeft) CharacterPart.PupilLeft else CharacterPart.PupilRight,
        white,
        pupil,
        glint,
    )

    private fun white(
        x: Float,
        y: Float,
        radiusX: Float,
        radiusY: Float,
    ) = floatArrayOf(x, y, radiusX, radiusY)

    private fun dot(
        x: Float,
        y: Float,
        radius: Float,
    ) = floatArrayOf(x, y, radius)
}

private fun ArtPainter.roundGlasses() {
    Round.temples.forEach { stroke(it, Ink, 3.4f, cap = StrokeCap.Round) }
    Round.lenses.forEach {
        fill(it, Color.White, alpha = 0.14f)
        stroke(it, Ink, 3.8f)
    }
    stroke(Round.bridge, Ink, 3.4f, cap = StrokeCap.Round)
    Round.highlights.forEach { stroke(it, Color.White, 2.2f, alpha = 0.75f, cap = StrokeCap.Round) }
}

private fun ArtPainter.starGlasses() {
    Star.temples.forEach { stroke(it, Star.frame, 3.4f, cap = StrokeCap.Round) }
    Star.lenses.forEach {
        fill(it, Color(0xFFFFD36E), alpha = 0.16f)
        stroke(it, Star.frame, 5.4f, join = StrokeJoin.Round)
    }
    Star.lenses.forEach { stroke(it, Color(0xFFFFCF4A), 3f, join = StrokeJoin.Round) }
    Star.highlights.forEach { stroke(it, Color(0xFFFFF6D6), 1.6f, cap = StrokeCap.Round) }
    fill(Star.spark, Color.White)
}

private fun ArtPainter.aviatorGlasses() {
    Aviator.temples.forEach { stroke(it, Color(0xFFC98B1C), 2.4f, cap = StrokeCap.Round) }
    Aviator.lenses.forEach { (lens, mirror, gold) ->
        fill(lens, mirror)
        stroke(lens, gold, 2.6f, join = StrokeJoin.Round)
    }
    stroke(Aviator.bar, Aviator.brass, 2.6f)
    stroke(Aviator.bridge, Aviator.brass, 2.2f, cap = StrokeCap.Round)
    Aviator.glare.forEach { stroke(it, Color.White, 2.6f, alpha = 0.55f, cap = StrokeCap.Round) }
    Aviator.softGlare.forEach { stroke(it, Color.White, 1.8f, alpha = 0.4f, cap = StrokeCap.Round) }
}

private fun ArtPainter.catEyeGlasses() {
    CatEye.temples.forEach { stroke(it, Color(0xFFC42A6E), 3.2f, cap = StrokeCap.Round) }
    CatEye.lenses.forEach {
        fill(it, Color.White, alpha = 0.14f)
        stroke(it, CatEye.frame, 3.8f, join = StrokeJoin.Round)
    }
    stroke(CatEye.bridge, CatEye.frame, 3.4f, cap = StrokeCap.Round)
    CatEye.highlights.forEach { stroke(it, Color.White, 2f, alpha = 0.7f, cap = StrokeCap.Round) }
    CatEye.gems.forEach { fill(it, Color.White) }
    CatEye.sparkles.forEach { fill(it, Color(0xFFFFE0F0)) }
}

private fun ArtPainter.retroGlasses() {
    Retro.temples.forEach { stroke(it, Color(0xFF5A2A10), 4f, cap = StrokeCap.Round) }
    Retro.lenses.forEach { (lens, tortoise) ->
        fill(lens, Color.White, alpha = 0.12f)
        stroke(lens, tortoise, 5f)
    }
    stroke(Retro.bridge, Color(0xFF6B3514), 4f, cap = StrokeCap.Round)
    Retro.highlights.forEach { stroke(it, Color.White, 1.8f, alpha = 0.7f, cap = StrokeCap.Round) }
    Retro.rivets.forEach { fill(it, Color(0xFFF3D9A4)) }
}

private fun ArtPainter.monocleGlasses() {
    stroke(Monocle.chain, Aviator.brass, 1.8f, cap = StrokeCap.Round, dash = Monocle.links)
    fill(Monocle.lens, Color.White, alpha = 0.16f)
    stroke(Monocle.lens, Monocle.gold, 3.6f)
    stroke(Monocle.rim, Color(0xFF9C6B12), 0.9f, alpha = 0.7f)
    stroke(Monocle.highlight, Color.White, 2.2f, alpha = 0.75f, cap = StrokeCap.Round)
    fill(Monocle.stud, Color(0xFFF2B53C))
}

private object Round {
    val temples = listOf(svg("M31 55 L19 51"), svg("M89 55 L101 51"))
    val lenses = listOf(circle(44f, 58f, 14f), circle(76f, 58f, 14f))
    val bridge = svg("M58 56.5 Q60 53 62 56.5")
    val highlights = listOf(svg("M35 51 Q38 47 43 46"), svg("M67 51 Q70 47 75 46"))
}

private object Star {
    val frame = Color(0xFFB86B00)
    val temples = listOf(svg("M24.4 54.5 L18 51.5"), svg("M95.6 54.5 L102 51.5"))
    val lenses =
        listOf(
            svg(
                "M41.01 39.60 L48.50 48.97 L60.36 50.77 L53.76 60.79 L55.71 72.62 L44.15 69.44 L33.50 74.95 " +
                    "L32.95 62.97 L24.42 54.55 L35.64 50.33 Z",
            ),
            svg(
                "M78.99 39.60 L84.36 50.33 L95.58 54.55 L87.05 62.97 L86.50 74.95 L75.85 69.44 L64.29 72.62 " +
                    "L66.24 60.79 L59.64 50.77 L71.50 48.97 Z",
            ),
        )
    val highlights = listOf(svg("M36 50.5 L40.6 43.5"), svg("M72 50.5 L76.6 43.5"))
    val spark = sparkAt(x = 92f, y = 36f, size = 8f)
}

private object Aviator {
    val brass = Color(0xFFE0A534)
    val temples = listOf(svg("M29.5 49.5 L19 48.5"), svg("M90.5 49.5 L101 48.5"))
    private val lens =
        svg("M29 50 C29 47.5, 31 46.5, 34 46.5 L55 46.5 C58.5 46.5, 59.5 49.5, 58.5 53 C56.5 62, 52 71, 42 71.5 C33 72, 28.5 64, 29 50 Z")
    val lenses =
        listOf(lens, lens.mirrored(BUDDY_VIEW_SIZE)).map { shape ->
            Triple(
                shape,
                linearIn(
                    shape,
                    Offset(0f, 0f),
                    Offset(0f, 1f),
                    0f to Color(0xFF1B1F5E).copy(alpha = 0.82f),
                    0.55f to Color(0xFF3A5BB8).copy(alpha = 0.55f),
                    1f to Color(0xFF7CF5FF).copy(alpha = 0.4f),
                ),
                goldIn(shape),
            )
        }
    val bar = svg("M55 46.5 L65 46.5")
    val bridge = svg("M57.5 52.5 Q60 50.3 62.5 52.5")
    val glare = listOf(svg("M33 60 L45 49"), svg("M65 60 L77 49"))
    val softGlare = listOf(svg("M36 65 L41 60.5"), svg("M68 65 L73 60.5"))
}

private object CatEye {
    val frame = Color(0xFFFF4F9A)
    val temples = listOf(svg("M29.5 50 L19 49"), svg("M90.5 50 L101 49"))
    private val lens =
        svg("M57 52 C50 46, 38 45, 26.5 43.5 C28 50, 29 56, 31.5 62 C34.5 70, 46 73, 53.5 68.5 C58.5 65, 59.5 57, 57 52 Z")
    val lenses = listOf(lens, lens.mirrored(BUDDY_VIEW_SIZE))
    val bridge = svg("M56.5 53.5 Q60 50 63.5 53.5")
    val highlights = listOf(svg("M33 50 Q37 47.5 42 47.5"), svg("M78 47.5 Q83 47.5 87 50"))
    val gems = listOf(circle(28.5f, 45.5f, 1.9f), circle(91.5f, 45.5f, 1.9f))
    val sparkles = listOf(circle(32.8f, 46.6f, 1.1f), circle(87.2f, 46.6f, 1.1f))
}

private object Retro {
    val temples = listOf(svg("M29.5 50 L18.5 48.5"), svg("M90.5 50 L101.5 48.5"))
    val lenses =
        listOf(rect(29.5f, 45.5f, 29f, 25f, 7f), rect(61.5f, 45.5f, 29f, 25f, 7f)).map { shape ->
            shape to
                linearIn(
                    shape,
                    Offset(0f, 0f),
                    Offset(1f, 1f),
                    0f to Color(0xFF6B3514),
                    0.3f to Color(0xFFB8692C),
                    0.55f to Color(0xFF4A220C),
                    0.8f to Color(0xFFA45A22),
                    1f to Color(0xFF3D1B08),
                )
        }
    val bridge = svg("M57.5 53 Q60 49.5 62.5 53")
    val highlights = listOf(svg("M34 50.5 L41 50.5"), svg("M66 50.5 L73 50.5"))
    val rivets = listOf(circle(31f, 47.5f, 1.2f), circle(89f, 47.5f, 1.2f))
}

private object Monocle {
    val chain = svg("M86.5 69 C 94 80, 88 92, 74 97.5")
    val links = PathEffect.dashPathEffect(floatArrayOf(2.6f, 1.8f))
    val lens = circle(76f, 58f, 14.5f)
    val gold = goldIn(lens)
    val rim = circle(76f, 58f, 12f)
    val highlight = svg("M67 51 Q70 46.5 75 45.5")
    val stud = circle(87f, 68f, 1.8f)
}

private fun goldIn(shape: Path) =
    linearIn(
        shape,
        Offset(0f, 0f),
        Offset(0f, 1f),
        0f to Color(0xFFFFE7A3),
        0.5f to Color(0xFFF2B53C),
        1f to Color(0xFFB87412),
    )

private fun sparkAt(
    x: Float,
    y: Float,
    size: Float,
): Path =
    svg("M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z").apply {
        transform(
            Matrix().apply {
                translate(x, y)
                scale(size / SPARK_BOX, size / SPARK_BOX)
            },
        )
    }

private val Ink = Color(0xFF221B52)
private val Pupil = Color(0xFF16123A)
private val EyePivotLeft = Offset(44f, 61f)
private val EyePivotRight = Offset(76f, 61f)
private val MouthPivot = Offset(60f, 80f)
private const val SPARK_BOX = 24f
