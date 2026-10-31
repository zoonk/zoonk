package com.zoonk.android.ui.characters

import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.LinearGradientShader
import androidx.compose.ui.graphics.Matrix
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.RadialGradientShader
import androidx.compose.ui.graphics.Shader
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.DrawTransform
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.PathParser
import kotlin.math.min

/** A character drawn in its own units (main's SVG `viewBox`), each expression's parts posed. */
internal interface CharacterDrawing<Expression> {
    val viewBox: Rect

    /** Crops to the box; otherwise loose parts (a raised arm, a glow) draw past it, as main's SVG does. */
    val clipsToBox: Boolean get() = false

    /** Parts an expression draws in a pose (the Trickster's slump), and parts only an act shows (a blink's lid line). */
    fun pose(
        expression: Expression,
        part: CharacterPart,
    ): PartPose? = null

    fun ArtPainter.draw(face: Expression)
}

internal fun <Expression> DrawScope.drawCharacter(
    drawing: CharacterDrawing<Expression>,
    face: Expression,
    posing: (CharacterPart) -> PartPose = { drawing.pose(face, it) ?: PartPose.Still },
) {
    val box = drawing.viewBox
    val scale = min(size.width / box.width, size.height / box.height)

    withTransform({
        translate(size.width / 2, size.height / 2)
        scale(scale, scale, pivot = Offset.Zero)
        translate(-box.center.x, -box.center.y)
    }) {
        val painter = ArtPainter(this, posing)

        if (drawing.clipsToBox) {
            clipRect(box.left, box.top, box.right, box.bottom) { with(drawing) { painter.draw(face) } }
        } else {
            with(drawing) { painter.draw(face) }
        }
    }
}

internal class ArtPainter(
    private val scope: DrawScope,
    private val posing: (CharacterPart) -> PartPose,
    private val alpha: Float = 1f,
) {
    fun part(
        part: CharacterPart,
        pivot: Offset,
        content: ArtPainter.() -> Unit,
    ) {
        val pose = posing(part)
        if (pose.opacity <= 0f) return

        scope.withTransform({
            translate(pose.translate.x, pose.translate.y)
            rotate(pose.rotate, pivot)
            scale(pose.scale.scaleX, pose.scale.scaleY, pivot)
        }) { ArtPainter(scope, posing, alpha * pose.opacity).content() }
    }

    fun group(
        alpha: Float = 1f,
        transform: DrawTransform.() -> Unit = {},
        content: ArtPainter.() -> Unit,
    ) = scope.withTransform(transform) { ArtPainter(scope, posing, this@ArtPainter.alpha * alpha).content() }

    fun clip(
        path: Path,
        content: ArtPainter.() -> Unit,
    ) = scope.clipPath(path) { content() }

    fun fill(
        path: Path,
        color: Color,
        alpha: Float = 1f,
    ) = scope.drawPath(path, color, alpha = this.alpha * alpha)

    fun fill(
        path: Path,
        brush: Brush,
        alpha: Float = 1f,
    ) = scope.drawPath(path, brush, alpha = this.alpha * alpha)

    fun stroke(
        path: Path,
        color: Color,
        width: Float,
        alpha: Float = 1f,
        cap: StrokeCap = StrokeCap.Butt,
        join: StrokeJoin = StrokeJoin.Miter,
        dash: PathEffect? = null,
    ) = scope.drawPath(path, color, alpha = this.alpha * alpha, style = Stroke(width, cap = cap, join = join, pathEffect = dash))

    fun stroke(
        path: Path,
        brush: Brush,
        width: Float,
        alpha: Float = 1f,
        cap: StrokeCap = StrokeCap.Butt,
        join: StrokeJoin = StrokeJoin.Miter,
    ) = scope.drawPath(path, brush, alpha = this.alpha * alpha, style = Stroke(width, cap = cap, join = join))
}

internal fun svg(data: String): Path = PathParser().parsePathString(data).toPath()

internal fun circle(
    x: Float,
    y: Float,
    radius: Float,
): Path = ellipse(x, y, radius, radius)

internal fun ellipse(
    x: Float,
    y: Float,
    radiusX: Float,
    radiusY: Float,
): Path = Path().apply { addOval(Rect(x - radiusX, y - radiusY, x + radiusX, y + radiusY)) }

internal fun rect(
    x: Float,
    y: Float,
    width: Float,
    height: Float,
    radius: Float = 0f,
): Path = Path().apply { addRoundRect(RoundRect(x, y, x + width, y + height, CornerRadius(radius))) }

internal fun Path.rotated(
    degrees: Float,
    pivotX: Float,
    pivotY: Float,
): Path =
    apply {
        transform(
            Matrix().apply {
                translate(pivotX, pivotY)
                rotateZ(degrees)
                translate(-pivotX, -pivotY)
            },
        )
    }

/** SVG's `matrix(-1 0 0 1 120 0)`: mirrored across the buddy's middle. */
internal fun Path.mirrored(width: Float): Path =
    Path().also { mirror ->
        mirror.addPath(this)
        mirror.transform(
            Matrix().apply {
                translate(width, 0f)
                scale(-1f, 1f)
            },
        )
    }

/** In the shape's own box (SVG's default `objectBoundingBox` units), so the gradient stretches with the shape. */
internal fun radialIn(
    shape: Path,
    center: Offset,
    radius: Float,
    vararg stops: Pair<Float, Color>,
): Brush =
    ShaderBrush(
        RadialGradientShader(center, radius, stops.map { it.second }, stops.map { it.first }).inBox(shape.getBounds()),
    )

/** Like `radialIn`, from `start` to `end` in the shape's box. */
internal fun linearIn(
    shape: Path,
    start: Offset,
    end: Offset,
    vararg stops: Pair<Float, Color>,
): Brush =
    ShaderBrush(
        LinearGradientShader(start, end, stops.map { it.second }, stops.map { it.first }).inBox(shape.getBounds()),
    )

private fun Shader.inBox(box: Rect): Shader =
    apply {
        setLocalMatrix(
            android.graphics.Matrix().apply {
                setScale(box.width, box.height)
                postTranslate(box.left, box.top)
            },
        )
    }
