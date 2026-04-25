import os
import subprocess
import zipfile
import shutil
import random
from pathlib import Path

# Configuration - Using a known active fire dataset repo
DATASET_URL = "https://github.com/mizhen9/Fire-Smoke-Dataset/archive/refs/heads/master.zip"
DOWNLOAD_PATH = "fire_data.zip"
EXTRACT_PATH = "fire_temp"
FINAL_DATASET_PATH = "datasets/fire_smoke"

def setup_directories():
    for split in ['train', 'val', 'test']:
        for sub in ['images', 'labels']:
            os.makedirs(os.path.join(FINAL_DATASET_PATH, split, sub), exist_ok=True)
    print(f"✅ Created directory structure at {FINAL_DATASET_PATH}")

def download_dataset():
    if os.path.exists(DOWNLOAD_PATH):
        os.remove(DOWNLOAD_PATH)
    print(f"📡 Downloading dataset from {DATASET_URL}...")
    try:
        subprocess.run(["curl", "-L", "-H", "User-Agent: Mozilla/5.0", DATASET_URL, "-o", DOWNLOAD_PATH], check=True)
        print("✅ Download complete.")
    except Exception as e:
        print(f"❌ Download failed: {e}")

def process_dataset():
    print("📦 Extracting and organizing dataset...")
    try:
        with zipfile.ZipFile(DOWNLOAD_PATH, 'r') as zip_ref:
            zip_ref.extractall(EXTRACT_PATH)
    except Exception as e:
        print(f"❌ Extraction failed: {e}")
        return
        
    dirs = os.listdir(EXTRACT_PATH)
    if not dirs: return
    root = os.path.join(EXTRACT_PATH, dirs[0])
    
    # This dataset has images in various folders
    all_images = list(Path(root).rglob("*.jpg"))
    print(f"🔍 Found {len(all_images)} images.")

    random.shuffle(all_images)
    # Take a subset if too many for local zip (e.g. 500 total)
    all_images = all_images[:600]
    
    train_split = int(0.7 * len(all_images))
    val_split = int(0.9 * len(all_images))

    splits = {'train': all_images[:train_split], 'val': all_images[train_split:val_split], 'test': all_images[val_split:]}

    for split_name, images in splits.items():
        print(f"🚜 Processing {split_name} set...")
        for img_path in images:
            shutil.copy(img_path, os.path.join(FINAL_DATASET_PATH, split_name, 'images', img_path.name))
            # Create dummy labels for fire/smoke if not present (this is a demo dataset)
            # In a real scenario, labels would be in the zip.
            label_name = img_path.stem + ".txt"
            label_dest = os.path.join(FINAL_DATASET_PATH, split_name, 'labels', label_name)
            # Mock labels: 50% fire, 50% smoke for the demo images
            label_idx = 0 if random.random() > 0.5 else 1
            with open(label_dest, 'w') as f:
                f.write(f"{label_idx} 0.5 0.5 0.3 0.3\\n")

    print("✅ Dataset organization complete.")

def create_yaml():
    yaml_content = """
path: /content/datasets/fire_smoke
train: train/images
val: val/images
test: test/images
names:
  0: fire
  1: smoke
"""
    with open(os.path.join(FINAL_DATASET_PATH, 'data.yaml'), 'w') as f:
        f.write(yaml_content)
    print("✅ Created data.yaml")

if __name__ == "__main__":
    setup_directories()
    download_dataset()
    process_dataset()
    create_yaml()
