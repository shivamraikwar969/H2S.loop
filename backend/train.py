import os
from ultralytics import YOLO

# Configuration
DATA_YAML = os.path.abspath("datasets/fire_smoke/data.yaml")
MODEL_NAME = "yolov8n.pt"  # Pre-trained base
OUTPUT_NAME = "fire_smoke_v8.pt"

def train():
    if not os.path.exists(DATA_YAML):
        print(f"❌ Error: data.yaml not found at {DATA_YAML}")
        return

    print("🚀 Initializing YOLOv8 Training...")
    print(f"📍 Dataset: {DATA_YAML}")
    
    # Load model
    model = YOLO(MODEL_NAME)

    # Train
    # Using parameters requested: 100 epochs, imgsz 640
    # Note: adjust batch size based on memory (using 8 as requested)
    results = model.train(
        data=DATA_YAML,
        epochs=100,
        imgsz=640,
        batch=8,
        name="fire_smoke_run",
        project="train_logs",
        augment=True,
        # Specific augmentations requested: blur, contrast, brightness
        # These are enabled by default in YOLOv8's mixup/mosaic/hsv_v tools, 
        # but we can explicitly set some.
        hsv_h=0.015, # Hue
        hsv_s=0.7,   # Saturation
        hsv_v=0.4,   # Value (bright/contrast)
        blur=0.1     # Blur augmentation
    )

    print("✅ Training complete.")
    
    # Save best weights to target location
    best_weights = os.path.join("train_logs", "fire_smoke_run", "weights", "best.pt")
    if os.path.exists(best_weights):
        import shutil
        shutil.copy(best_weights, OUTPUT_NAME)
        print(f"⭐ Exported best model to: {OUTPUT_NAME}")
    else:
        print("⚠️ Warning: Best weights not found. Check train_logs/ folder.")

if __name__ == "__main__":
    train()
