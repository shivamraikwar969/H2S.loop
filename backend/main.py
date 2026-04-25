import cv2
import numpy as np
import io
import json
import base64
import asyncio
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image

app = FastAPI(title="Silent Shield AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- YOLOv8 Model Initialization ---
MODEL_PATH = "fire_smoke_v8.pt" # Strict model requirement

try:
    model_fire = YOLO(MODEL_PATH)
    print("="*50)
    print(f"🚀 YOLOv8 FIRE/SMOKE INITIALIZATION")
    print(f"📍 Model File: {MODEL_PATH}")
    print(f"✅ Detection Engine: ONLINE")
except Exception as e:
    print(f"❌ Failed to load YOLOv8 custom model: {e}")
    model_fire = None

try:
    model_general = YOLO("yolov8n.pt")
    print(f"🚀 YOLOv8n REAL LFE INITIALIZATION ONLINE")
except Exception as e:
    print(f"❌ Failed to load YOLOv8n model: {e}")
    model_general = None

# --- Mock Data ---
active_connections = []

@app.get("/")
def read_root():
    return {"status": "online", "model": MODEL_PATH}

@app.post("/detect")
async def detect_objects(file: UploadFile = File(...)):
    if not model_fire and not model_general:
        raise HTTPException(status_code=503, detail="YOLOv8 Models not initialized")
    
    try:
        # Read image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        img_np = np.array(image)
        
        detections = []
        
        # Run fire/smoke inference
        if model_fire:
            results_fire = model_fire.predict(img_np, conf=0.40, verbose=False)
            for result in results_fire:
                for box in result.boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = float(box.conf[0])
                    cls = int(box.cls[0])
                    label = model_fire.names[cls].lower()
                    detections.append({"label": label, "confidence": conf, "box": [x1, y1, x2, y2]})
                    print(f"🔥 DETECTED (FIRE): {label} ({conf:.2f})")
                    
        # Run general inference
        if model_general:
            results_gen = model_general.predict(img_np, conf=0.40, verbose=False)
            for result in results_gen:
                for box in result.boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = float(box.conf[0])
                    cls = int(box.cls[0])
                    label = model_general.names[cls].lower()
                    detections.append({"label": label, "confidence": conf, "box": [x1, y1, x2, y2]})
                    print(f"🔍 DETECTED (GEN): {label} ({conf:.2f})")
        
        if not detections:
            print("📭 No objects detected in frame.")
        
        return {"detections": detections}
    except Exception as e:
        print(f"Error during detection: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.remove(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
