import * as faceapi from '@vladmandic/face-api';

let isModelLoaded = false;
let isInitializing = false;
let modelLoadingError = null;

const prevFrames = {};
const fireBuffers = {};  
const smokeBuffers = {}; 

const BUFFER_SIZE = 5; // Multi-frame confirmation (as requested)
const CONF_THRESHOLD = 0.40; // Lowered to 0.4 for sensitivity

export const isAIReady = () => ({ loaded: isModelLoaded, error: modelLoadingError });

export const initAIModels = async () => {
  if (isModelLoaded || isInitializing) return;
  isInitializing = true;
  try {
    const modelPath = '/models';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
      faceapi.nets.faceExpressionNet.loadFromUri(modelPath)
    ]);
    isModelLoaded = true;
    console.log("✅ FaceAPI Models Online.");
  } catch (err) {
    modelLoadingError = err.message;
  } finally {
    isInitializing = false;
  }
};

const checkBufferStability = (buffer, threshold = 0.4) => {
  if (buffer.length < 3) return false; // Not enough history
  const detections = buffer.filter(val => val >= threshold).length;
  return detections >= 3; // 3+ out of 5 required
};

const getSmoothedScore = (buffer, newScore) => {
  buffer.push(newScore);
  if (buffer.length > BUFFER_SIZE) buffer.shift();
  const sum = buffer.reduce((a, b) => a + b, 0);
  return sum / buffer.length;
};

// --- YOLOv8 Backend Integration ---
const lastYOLOTime = {};
const lastYOLOResults = {};

export const processVideoFrame = async (videoEl, camNum) => {
  if (!isModelLoaded || !videoEl || videoEl.paused || videoEl.ended) return null;

  try {
    // 1. Face & Expression Detection (Local)
    const faceDetections = await faceapi
      .detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 }))
      .withFaceExpressions();

    let frameResult = {
      expressions: [],
      motion: 0,
      timestamp: Date.now(),
      detections: [],
      fire: null,
      smoke: null,
      fight: false
    };

    if (faceDetections.length > 0) {
      faceDetections.forEach(det => {
        frameResult.detections.push({ box: det.detection.box, type: 'face', score: det.detection.score });
        const expressions = det.expressions;
        let dominant = "";
        let maxScore = 0;
        for (const [expr, score] of Object.entries(expressions)) {
          if (score > maxScore) { maxScore = score; dominant = expr; }
        }
        if (maxScore > 0.4) {
          frameResult.expressions.push({ emotion: dominant, confidence: maxScore });
        }
      });
    }

    // 2. YOLOv8 Detection (Remote API - Every 1 second)
    const now = Date.now();
    if (!lastYOLOTime[camNum] || now - lastYOLOTime[camNum] > 1000) {
      lastYOLOTime[camNum] = now;
      detectFireSmokeRemote(videoEl, camNum);
    }

    // 3. Include YOLO detections in the frame result for HUD drawing
    const yoloDetections = lastYOLOResults[camNum] || [];
    yoloDetections.forEach(det => {
      // Add to main detections array for HUD
      frameResult.detections.push({ 
        box: det.box, 
        type: det.label, 
        score: det.confidence 
      });
      
      // Update fire/smoke summary stats with stability check
      const label = det.label.toLowerCase();
      const isFire = label.includes('fire') || label.includes('flame');
      const isSmoke = label.includes('smoke');

      if (isFire && checkBufferStability(fireBuffers[camNum] || [])) {
        if (!frameResult.fire || det.confidence > parseFloat(frameResult.fire.score)) {
          frameResult.fire = { score: det.confidence.toFixed(2), confirmed: true };
        }
      }
      if (isSmoke && checkBufferStability(smokeBuffers[camNum] || [])) {
        if (!frameResult.smoke || det.confidence > parseFloat(frameResult.smoke.score)) {
          frameResult.smoke = { score: det.confidence.toFixed(2), confirmed: true };
        }
      }
    });

    return frameResult;
  } catch (err) {
    return null;
  }
};

async function detectFireSmokeRemote(videoEl, camNum) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(async (blob) => {
       const formData = new FormData();
       formData.append("file", blob, "frame.jpg");
       
       const response = await fetch("http://localhost:8001/detect", {
           method: "POST",
           body: formData
       });
       
       if (response.ok) {
           const data = await response.json();
           const detections = data.detections || [];
           
           let fireMax = 0;
           let smokeMax = 0;
           
           detections.forEach(d => {
               if (d.label === "fire") fireMax = Math.max(fireMax, d.confidence);
               if (d.label === "smoke") smokeMax = Math.max(smokeMax, d.confidence);
           });
           
           // Update buffers
           if (!fireBuffers[camNum]) fireBuffers[camNum] = [];
           fireBuffers[camNum].push(fireMax);
           if (fireBuffers[camNum].length > BUFFER_SIZE) fireBuffers[camNum].shift();
           
           if (!smokeBuffers[camNum]) smokeBuffers[camNum] = [];
           smokeBuffers[camNum].push(smokeMax);
           if (smokeBuffers[camNum].length > BUFFER_SIZE) smokeBuffers[camNum].shift();
           
           lastYOLOResults[camNum] = detections;
       }
    }, "image/jpeg", 0.8);
  } catch (err) {
    console.error("YOLO Backend communication error:", err);
  }
}
