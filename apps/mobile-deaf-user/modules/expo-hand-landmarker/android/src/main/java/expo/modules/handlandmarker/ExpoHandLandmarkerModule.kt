package expo.modules.handlandmarker

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarkerResult
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.components.containers.NormalizedLandmark
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer

/**
 * ExpoHandLandmarkerModule — Expo Module API wrapper for MediaPipe HandLandmarker.
 *
 * Provides:
 *   - initHandLandmarker(options)    : initialise the detector
 *   - destroyHandLandmarker()        : release resources
 *   - processFrame(base64Jpeg, isFrontCamera, timestampMs) : detect and emit results
 *
 * Emits "onHandLandmarkerResult" events with the structure:
 *   { hands: [ { handedness, landmarks: [{x,y,z}×21], score } ], timestampMs }
 *
 * HANDEDNESS CONTRACT:
 *   MediaPipe reports handedness from the image perspective. With front cameras
 *   the image is mirrored left-right, so MediaPipe's "Left" = anatomical Right
 *   and "Right" = anatomical Left. This module swaps labels when isFrontCamera=true
 *   so the TypeScript layer always receives anatomically-correct labels.
 *
 * IMPORTANT: This module requires the MediaPipe Tasks Vision AAR to be added to
 * the project. Add the following to android/app/build.gradle:
 *
 *   implementation("com.google.mediapipe:tasks-vision:0.10.22")
 *
 * The model asset "hand_landmarker.task" must be placed in:
 *   android/app/src/main/assets/hand_landmarker.task
 *
 * Download from: https://storage.googleapis.com/mediapipe-models/hand_landmarker/
 *                hand_landmarker/float16/latest/hand_landmarker.task
 */
class ExpoHandLandmarkerModule : Module() {
    private var handLandmarker: HandLandmarker? = null

    override fun definition() = ModuleDefinition {
        Name("ExpoHandLandmarker")

        // ---------- Functions ----------

        AsyncFunction("initHandLandmarker") { options: Map<String, Any>, promise: Promise ->
            try {
                handLandmarker?.close()
                handLandmarker = null

                val numHands = (options["numHands"] as? Number)?.toInt() ?: 2
                val minDetection = (options["minHandDetectionConfidence"] as? Number)?.toFloat() ?: 0.5f
                val minPresence = (options["minHandPresenceConfidence"] as? Number)?.toFloat() ?: 0.5f
                val minTracking = (options["minTrackingConfidence"] as? Number)?.toFloat() ?: 0.5f

                val baseOptions = BaseOptions.builder()
                    .setModelAssetPath("hand_landmarker.task")
                    .build()

                val landmarkerOptions = HandLandmarker.HandLandmarkerOptions.builder()
                    .setBaseOptions(baseOptions)
                    .setRunningMode(RunningMode.LIVE_STREAM)
                    .setNumHands(numHands)
                    .setMinHandDetectionConfidence(minDetection)
                    .setMinHandPresenceConfidence(minPresence)
                    .setMinTrackingConfidence(minTracking)
                    .setResultListener { result, _ -> emitHandResult(result, false) }
                    .setErrorListener { err -> sendEvent("onHandLandmarkerError", mapOf("message" to err.message)) }
                    .build()

                val ctx = appContext.reactContext
                    ?: throw RuntimeException("React context not available")

                handLandmarker = HandLandmarker.createFromOptions(ctx, landmarkerOptions)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("INIT_ERROR", e.message ?: "Unknown error", e)
            }
        }

        AsyncFunction("destroyHandLandmarker") { promise: Promise ->
            try {
                handLandmarker?.close()
                handLandmarker = null
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("DESTROY_ERROR", e.message ?: "Unknown error", e)
            }
        }

        /**
         * Process a JPEG frame (base64-encoded) from Expo Camera's onCameraFrameAvailable.
         *
         * @param base64Jpeg  Base64-encoded JPEG byte string.
         * @param isFrontCamera  True when the front (selfie) camera is active.
         * @param timestampMs  Frame timestamp in milliseconds.
         *
         * Results are emitted asynchronously via "onHandLandmarkerResult".
         */
        AsyncFunction("processFrame") { base64Jpeg: String, isFrontCamera: Boolean, timestampMs: Double, promise: Promise ->
            try {
                val lm = handLandmarker
                if (lm == null) {
                    promise.reject("NOT_INIT", "HandLandmarker not initialised — call initHandLandmarker first", null)
                    return@AsyncFunction
                }

                val bytes = android.util.Base64.decode(base64Jpeg, android.util.Base64.DEFAULT)
                val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    ?: throw RuntimeException("Could not decode JPEG frame")

                val mpImage = BitmapImageBuilder(bitmap).build()
                lm.detectAsync(mpImage, timestampMs.toLong())
                // Result arrives via the ResultListener above; isFrontCamera stored separately.
                _lastIsFrontCamera = isFrontCamera
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("PROCESS_ERROR", e.message ?: "Unknown error", e)
            }
        }

        // ---------- Events ----------
        Events("onHandLandmarkerResult", "onHandLandmarkerError")
    }

    private var _lastIsFrontCamera = true

    private fun emitHandResult(result: HandLandmarkerResult, isFrontCamera: Boolean) {
        val actualFront = _lastIsFrontCamera
        val handList = mutableListOf<Map<String, Any>>()

        for (i in 0 until result.handedness().size) {
            val handedness = result.handedness().getOrNull(i)?.firstOrNull()
            val landmarks = result.landmarks().getOrNull(i)
            if (handedness == null || landmarks == null) continue

            // MediaPipe reports from image perspective. Front-camera images are
            // horizontally mirrored so we swap "Left"/"Right" to get anatomical labels.
            val rawLabel = handedness.categoryName() ?: continue
            val anatomicalLabel = if (actualFront) {
                if (rawLabel == "Left") "Right" else "Left"
            } else {
                rawLabel
            }

            val score = handedness.score()

            val landmarkList = landmarks.map { lm ->
                mapOf("x" to lm.x().toDouble(), "y" to lm.y().toDouble(), "z" to lm.z().toDouble())
            }

            handList.add(mapOf(
                "handedness" to anatomicalLabel,
                "landmarks" to landmarkList,
                "score" to score.toDouble()
            ))
        }

        sendEvent("onHandLandmarkerResult", mapOf(
            "hands" to handList,
            "timestampMs" to result.timestampMs().toDouble()
        ))
    }
}
