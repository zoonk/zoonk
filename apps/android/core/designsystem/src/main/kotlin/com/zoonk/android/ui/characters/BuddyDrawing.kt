package com.zoonk.android.ui.characters

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap

/**
 * Main's `@zoonk/ui` buddy, path for path. Its colors are artwork, drawn the same in light and dark
 * as main draws them; only the belt takes the theme's belt color.
 */
internal class BuddyDrawing(
    private val look: BuddyLook,
    private val crop: BuddyCrop,
    private val belt: Color,
) : CharacterDrawing<BuddyExpression> {
    private val stageScale = look.stage.scale

    /** The face's square, so a baby's face isn't a dot at icon sizes. */
    override val viewBox: Rect =
        when (crop) {
            BuddyCrop.Whole -> {
                Rect(0f, 0f, BUDDY_VIEW_SIZE, BUDDY_VIEW_SIZE)
            }

            BuddyCrop.Face -> {
                val size = FACE_SIZE * stageScale
                val centerY = Ground.y - (Ground.y - FACE_CENTER_Y) * stageScale
                Rect(Offset(Ground.x - size / 2, centerY - size / 2), Size(size, size))
            }
        }

    override val clipsToBox: Boolean get() = crop == BuddyCrop.Face

    override fun pose(
        expression: BuddyExpression,
        part: CharacterPart,
    ): PartPose? = if (part == CharacterPart.LidLeft || part == CharacterPart.LidRight) PartPose.Hidden else null

    private val lights =
        when (look.kind) {
            BuddyKind.Zu -> listOf(Light(36f, 11f, 11f, look.glow), Light(84f, 11f, 11f, look.glow))
            BuddyKind.Beep -> listOf(Light(60f, 10f, 10f, look.glow))
            BuddyKind.Noodle, BuddyKind.Otto -> emptyList()
        }

    override fun ArtPainter.draw(face: BuddyExpression) {
        val napping = face == BuddyExpression.Sleepy

        val drawFace: ArtPainter.() -> Unit = {
            part(CharacterPart.Face, FacePivot) {
                drawBuddyFace(face)
                group(transform = { if (napping) translate(0f, SLEEPY_EYES_OFFSET) }) { drawGlasses(look.glasses) }
            }
        }

        // Growth scales around the feet, so a buddy always stands on the same ground line.
        group(transform = { scale(stageScale, stageScale, Ground) }) {
            when (look.kind) {
                BuddyKind.Zu -> zu(napping, drawFace)
                BuddyKind.Noodle -> noodle(drawFace)
                BuddyKind.Beep -> beep(napping, drawFace)
                BuddyKind.Otto -> otto(drawFace)
            }
        }
    }

    /** The belt's dark edge keeps a white or black belt from vanishing into the body. */
    private fun ArtPainter.beltPiece(
        shape: Path,
        edge: Float,
        width: Float = 1f,
    ) {
        fill(shape, belt)
        stroke(shape, Color.Black, width, alpha = edge)
    }

    /** The glow holds still: the buddy shows on everyday screens, where nothing loops. */
    private fun ArtPainter.light(light: Light) {
        light.halo?.let { fill(it, light.haloFill, alpha = look.glow) }
        fill(light.bulb, LightColor)
        fill(light.glint, Color.White, alpha = 0.85f)
    }

    private fun ArtPainter.zu(
        napping: Boolean,
        face: ArtPainter.() -> Unit,
    ) {
        part(CharacterPart.Shadow, Offset(60f, 115f)) { fill(Zu.shadow, Color.Black, alpha = 0.12f) }
        part(CharacterPart.Feet, Offset(60f, 111f)) {
            fill(Zu.footLeft, Zu.limb)
            fill(Zu.footRight, Zu.limb)
        }
        part(CharacterPart.Body, Offset(60f, 112f)) {
            part(CharacterPart.ArmLeft, Offset(42.5f, 89.5f)) { fill(Zu.armLeft, Zu.arm) }
            part(CharacterPart.ArmRight, Offset(77.5f, 89.5f)) { fill(Zu.armRight, Zu.arm) }
            part(CharacterPart.Torso, Offset(60f, 97f)) {
                fill(Zu.torso, Zu.torsoSkin)
                clip(Zu.torso) { beltPiece(Zu.belt, edge = 0.14f, width = 1.2f) }
                beltPiece(Zu.tieLeft, edge = 0.16f)
                beltPiece(Zu.tieRight, edge = 0.16f)
                beltPiece(Zu.knot, edge = 0.2f)
            }
            part(CharacterPart.Head, Offset(60f, 86f)) {
                zuAntenna(CharacterPart.AntennaLeft, napping)
                zuAntenna(CharacterPart.AntennaRight, napping)
                fill(Zu.head, Zu.headSkin)
                fill(Zu.shine, Color.White, alpha = 0.4f)
                fill(Zu.spotRight, Color.White, alpha = 0.28f)
                fill(Zu.spotFarRight, Color.White, alpha = 0.28f)
                fill(Zu.spotLeft, Color.White, alpha = 0.22f)
                face()
            }
        }
    }

    private fun ArtPainter.zuAntenna(
        side: CharacterPart,
        napping: Boolean,
    ) {
        val left = side == CharacterPart.AntennaLeft

        part(side, Offset(if (left) 48f else 72f, 31f)) {
            if (napping) {
                stroke(if (left) Zu.droopLeft else Zu.droopRight, Zu.limb, 3.6f, cap = StrokeCap.Round)
                fill(if (left) Zu.dimLeft else Zu.dimRight, DimLight)
            } else {
                stroke(if (left) Zu.stalkLeft else Zu.stalkRight, Zu.limb, 3.6f, cap = StrokeCap.Round)
                light(lights[if (left) 0 else 1])
            }
        }
    }

    private fun ArtPainter.noodle(face: ArtPainter.() -> Unit) {
        part(CharacterPart.Shadow, Offset(60f, 113f)) { fill(Noodle.shadow, Color.Black, alpha = 0.08f) }
        part(CharacterPart.Feet, Offset(60f, 106f)) {
            fill(Noodle.footLeft, Noodle.foot)
            fill(Noodle.footRight, Noodle.foot)
        }
        part(CharacterPart.Body, Offset(60f, 108f)) {
            part(CharacterPart.ArmLeft, Offset(22f, 70f)) { fill(Noodle.armLeft, Noodle.arm) }
            part(CharacterPart.ArmRight, Offset(98f, 70f)) { fill(Noodle.armRight, Noodle.arm) }
            part(CharacterPart.Head, Offset(60f, 104f)) {
                clip(Noodle.outline) {
                    fill(Noodle.canvas, Noodle.shade)
                    beltPiece(Noodle.band, edge = 0.12f, width = 1.5f)
                }
                Noodle.folds.forEach { stroke(it, Noodle.fold, 3f, alpha = 0.8f, cap = StrokeCap.Round) }
                fill(Noodle.shine, Color.White, alpha = 0.35f)
                beltPiece(Noodle.tieLeft, edge = 0.15f, width = 1.2f)
                beltPiece(Noodle.tieRight, edge = 0.15f, width = 1.2f)
                beltPiece(Noodle.knot, edge = 0.18f, width = 1.2f)
                face()
            }
        }
    }

    private fun ArtPainter.beep(
        napping: Boolean,
        face: ArtPainter.() -> Unit,
    ) {
        part(CharacterPart.Shadow, Offset(60f, 115.5f)) { fill(Beep.shadow, Color.Black, alpha = 0.12f) }
        part(CharacterPart.Feet, Offset(60f, 110f)) {
            fill(Beep.footLeft, Beep.steel)
            fill(Beep.footRight, Beep.steel)
        }
        part(CharacterPart.Body, Offset(60f, 112f)) {
            part(CharacterPart.ArmLeft, Offset(36f, 94f)) { fill(Beep.armLeft, Beep.arm) }
            part(CharacterPart.ArmRight, Offset(84f, 94f)) { fill(Beep.armRight, Beep.arm) }
            part(CharacterPart.Torso, Offset(60f, 101f)) {
                fill(Beep.torso, Beep.torsoMetal)
                clip(Beep.torso) { beltPiece(Beep.belt, edge = 0.14f, width = 1.2f) }
                beltPiece(Beep.tieLeft, edge = 0.16f)
                beltPiece(Beep.tieRight, edge = 0.16f)
                beltPiece(Beep.knot, edge = 0.2f)
            }
            part(CharacterPart.Head, Offset(60f, 92f)) {
                part(CharacterPart.Antenna, Offset(60f, 26f)) {
                    if (napping) {
                        stroke(Beep.droop, Beep.steel, 3.6f, cap = StrokeCap.Round)
                        fill(Beep.dim, DimLight)
                    } else {
                        stroke(Beep.stalk, Beep.steel, 3.6f, cap = StrokeCap.Round)
                        light(lights[0])
                    }
                }
                fill(Beep.shell, Beep.shellMetal)
                stroke(Beep.shell, Beep.steel, 1.4f, alpha = 0.35f)
                fill(Beep.earLeft, Beep.ear)
                fill(Beep.earRight, Beep.ear)
                fill(Beep.screen, Beep.screenFill)
                stroke(Beep.screen, Beep.screenEdge, 1.5f, alpha = 0.55f)
                fill(Beep.shine, Color.White, alpha = 0.8f)
                face()
            }
        }
    }

    private fun ArtPainter.otto(face: ArtPainter.() -> Unit) {
        part(CharacterPart.Shadow, Offset(60f, 116f)) { fill(Otto.shadow, Color.Black, alpha = 0.12f) }
        // The outer tentacles are Otto's arms; the three between them stand.
        part(CharacterPart.Body, Offset(60f, 112f)) {
            part(CharacterPart.ArmLeft, Offset(36f, 84f)) {
                stroke(Otto.armLeft, Otto.tentacle, 9f, cap = StrokeCap.Round)
                fill(Otto.armTipLeft, Otto.tip, alpha = 0.9f)
            }
            part(CharacterPart.ArmRight, Offset(84f, 84f)) {
                stroke(Otto.armRight, Otto.tentacle, 9f, cap = StrokeCap.Round)
                fill(Otto.armTipRight, Otto.tip, alpha = 0.9f)
            }
            part(CharacterPart.Feet, Offset(60f, 112f)) {
                Otto.legs.forEach { stroke(it, Otto.tentacle, 9f, cap = StrokeCap.Round) }
                Otto.legTips.forEach { fill(it, Otto.tip, alpha = 0.9f) }
            }
            part(CharacterPart.Head, Offset(60f, 90f)) {
                fill(Otto.head, Otto.skin)
                beltPiece(Otto.belt, edge = 0.16f, width = 1.2f)
                beltPiece(Otto.tieLeft, edge = 0.16f)
                beltPiece(Otto.tieRight, edge = 0.16f)
                beltPiece(Otto.knot, edge = 0.2f)
                fill(Otto.shine, Color.White, alpha = 0.42f)
                Otto.spots.forEach { fill(it, Otto.spot) }
                face()
            }
        }
    }
}

enum class BuddyCrop { Whole, Face }

private class Light(
    x: Float,
    y: Float,
    haloRadius: Float,
    glow: Float,
) {
    private val reach = haloRadius * (1 + HALO_GROWTH * glow)
    val halo: Path? = if (glow > 0f) circle(x, y, reach) else null
    val haloFill: Brush =
        Brush.radialGradient(
            0f to Color(0xFFFFB35C).copy(alpha = 0.95f),
            1f to Color(0xFFFF8A3D).copy(alpha = 0f),
            center = Offset(x, y),
            radius = reach,
        )
    val bulb = circle(x, y, 5.2f)
    val glint = circle(x - 1.6f, y - 1.6f, 1.7f)
}

private object Zu {
    val limb = Color(0xFF3FB897)
    val arm = Color(0xFF6FDFBF)
    private val skinStops = arrayOf(0f to Color(0xFFC9FFF0), 0.55f to Color(0xFF86ECD0), 1f to Color(0xFF4FCDAC))
    val shadow = ellipse(60f, 115f, 24f, 3.8f)
    val footLeft = ellipse(51f, 111f, 7.5f, 4.6f)
    val footRight = ellipse(69f, 111f, 7.5f, 4.6f)
    val armLeft = ellipse(39f, 96f, 5.5f, 8f).rotated(28f, 39f, 96f)
    val armRight = ellipse(81f, 96f, 5.5f, 8f).rotated(-28f, 81f, 96f)
    val torso = ellipse(60f, 97f, 21f, 15.5f)
    val torsoSkin = radialIn(torso, Offset(0.35f, 0.28f), 0.8f, *skinStops)
    val belt = rect(30f, 96f, 60f, 7.5f)
    val tieLeft = svg("M58.5 101 l-6 9 l3.6 1.2 l5 -8 z")
    val tieRight = svg("M61.5 101 l6 9 l-3.6 1.2 l-5 -8 z")
    val knot = rect(55f, 94.5f, 10f, 10f, 3f)
    val head = ellipse(60f, 56f, 42f, 33f)
    val headSkin = radialIn(head, Offset(0.35f, 0.28f), 0.8f, *skinStops)
    val shine = ellipse(44f, 33f, 13f, 6f).rotated(-14f, 44f, 33f)
    val spotRight = circle(84f, 38f, 3.2f)
    val spotFarRight = circle(91f, 46f, 2f)
    val spotLeft = circle(30f, 42f, 2.4f)
    val stalkLeft = svg("M48 31 Q45 19 37 12")
    val stalkRight = svg("M72 31 Q75 19 83 12")
    val droopLeft = svg("M48 31 Q40 25 31 27")
    val droopRight = svg("M72 31 Q80 25 89 27")
    val dimLeft = circle(30f, 27.5f, 4.6f)
    val dimRight = circle(90f, 27.5f, 4.6f)
}

private object Noodle {
    val foot = Color(0xFFE8628F)
    val arm = Color(0xFFFF8FB3)
    val fold = Color(0xFFE0598A)
    val shadow = ellipse(60f, 113f, 30f, 4.5f)
    val footLeft = ellipse(47f, 106f, 9f, 6f)
    val footRight = ellipse(73f, 106f, 9f, 6f)
    val armLeft = ellipse(17f, 74f, 7f, 9f).rotated(25f, 17f, 74f)
    val armRight = ellipse(103f, 74f, 7f, 9f).rotated(-25f, 103f, 74f)
    val outline =
        Path().apply {
            addPath(circle(40f, 46f, 22f))
            addPath(circle(60f, 37f, 25f))
            addPath(circle(80f, 46f, 22f))
            addPath(ellipse(60f, 70f, 44f, 37f))
        }
    val canvas = rect(0f, 0f, BUDDY_VIEW_SIZE, BUDDY_VIEW_SIZE)
    val shade = radialIn(canvas, Offset(0.4f, 0.3f), 0.75f, 0f to Color(0xFFFFB3CB), 1f to Color(0xFFFF7AA6))
    val band = rect(0f, 86f, 120f, 11f)
    val folds =
        listOf(
            svg("M47 27 q6 -7 13 -1"),
            svg("M65 22 q7 -5 13 2"),
            svg("M28 46 q5 -6 11 -2"),
            svg("M82 44 q6 -4 11 2"),
            svg("M58 40 q3 -4 7 -2"),
        )
    val shine = ellipse(44f, 30f, 9f, 5f).rotated(-20f, 44f, 30f)
    val tieLeft = svg("M58 91 l-9 14 l5 2 l8 -12 z")
    val tieRight = svg("M62 91 l9 14 l-5 2 l-8 -12 z")
    val knot = rect(53f, 84f, 14f, 14f, 4f)
}

private object Beep {
    val steel = Color(0xFF7C86C4)
    val arm = Color(0xFFB3BBE6)
    val ear = Color(0xFF8F98D1)
    val screenFill = Color(0xFFFBFCFF)
    val screenEdge = Color(0xFF9AA3D6)
    private val metalStops = arrayOf(0f to Color(0xFFF4F5FF), 0.6f to Color(0xFFCDD2F2), 1f to Color(0xFFA1AADB))
    val shadow = ellipse(60f, 115.5f, 24f, 3.6f)
    val footLeft = rect(45f, 106f, 12f, 9f, 4.5f)
    val footRight = rect(63f, 106f, 12f, 9f, 4.5f)
    val armLeft = rect(28f, 93f, 10f, 17f, 5f).rotated(24f, 33f, 101f)
    val armRight = rect(82f, 93f, 10f, 17f, 5f).rotated(-24f, 87f, 101f)
    val torso = rect(38f, 90f, 44f, 22f, 10f)
    val torsoMetal = linearIn(torso, Offset(0f, 0f), Offset(0f, 1f), *metalStops)
    val belt = rect(30f, 98f, 60f, 7f)
    val tieLeft = svg("M58.5 102.5 l-6 8.5 l3.6 1.2 l5 -7.5 z")
    val tieRight = svg("M61.5 102.5 l6 8.5 l-3.6 1.2 l-5 -7.5 z")
    val knot = rect(55f, 96.5f, 10f, 10f, 3f)
    val stalk = svg("M60 26 V15")
    val droop = svg("M60 26 Q60 18 68 17")
    val dim = circle(71.5f, 17f, 4.6f)
    val shell = rect(16f, 24f, 88f, 70f, 24f)
    val shellMetal = linearIn(shell, Offset(0f, 0f), Offset(0f, 1f), *metalStops)
    val earLeft = circle(15f, 60f, 5.5f)
    val earRight = circle(105f, 60f, 5.5f)
    val screen = rect(24f, 34f, 72f, 54f, 18f)
    val shine = rect(30f, 27.5f, 26f, 3.6f, 1.8f)
}

private object Otto {
    val tentacle = Color(0xFFA88AF7)
    val tip = Color(0xFFEFE6FF)
    val spot = Color(0xFFB69CF2)
    val shadow = ellipse(60f, 116f, 30f, 3.4f)
    val armLeft = svg("M36 84 C 28 95, 18 99, 16 107 C 15 113, 23 114, 25 109")
    val armRight = svg("M84 84 C 92 95, 102 99, 104 107 C 105 113, 97 114, 95 109")
    val armTipLeft = circle(19f, 104f, 1.8f)
    val armTipRight = circle(101f, 104f, 1.8f)
    val legs =
        listOf(
            svg("M48 88 C 44 99, 39 105, 42 112"),
            svg("M72 88 C 76 99, 81 105, 78 112"),
            svg("M60 90 C 60 100, 57 106, 61 112"),
        )
    val legTips = listOf(circle(43.5f, 106f, 1.6f), circle(76.5f, 106f, 1.6f), circle(59f, 104f, 1.6f))
    val head = svg("M60 16 C 86 16, 102 35, 102 58 C 102 79, 88 92, 60 92 C 32 92, 18 79, 18 58 C 18 35, 34 16, 60 16 Z")
    val skin =
        radialIn(
            head,
            Offset(0.35f, 0.26f),
            0.82f,
            0f to Color(0xFFF1E9FF),
            0.5f to Color(0xFFC6ADFF),
            1f to Color(0xFF8C69F0),
        )
    val belt = rect(27f, 87f, 66f, 7f, 3.5f)
    val tieLeft = svg("M82.5 91 l-3 9 l3.6 .8 l2.4 -8 z")
    val tieRight = svg("M85.5 91 l5 8 l-3.4 1.4 l-3.6 -7.6 z")
    val knot = rect(79f, 85.5f, 10f, 10f, 3f)
    val shine = ellipse(44f, 30f, 13f, 6f).rotated(-14f, 44f, 30f)
    val spots = listOf(circle(62f, 25f, 3.6f), circle(81f, 31f, 3f), circle(90f, 45f, 2.4f))
}

private val LightColor = Color(0xFFFF8A3D)
private val DimLight = Color(0xFFC9A37E)

private val Ground = Offset(60f, 116f)
private val FacePivot = Offset(60f, 64f)
internal const val BUDDY_VIEW_SIZE = 120f
private const val FACE_CENTER_Y = 60f
private const val FACE_SIZE = 96f
private const val HALO_GROWTH = 1.5f
