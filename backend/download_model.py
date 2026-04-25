import requests
import os

MODEL_URL = "https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8n.pt"

def download_file(url, filename):
    print(f"📥 Downloading {filename} from {url}...")
    try:
        response = requests.get(url, stream=True)
        if response.status_code == 200:
            with open(filename, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print("✅ Download complete.")
        else:
            print(f"❌ Failed to download file. Status code: {response.status_code}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    if not os.path.exists("yolov8n.pt"):
        download_file(MODEL_URL, "yolov8n.pt")
    
    print("\n🔥 To get the specialized FIRE & SMOKE model:")
    print("1. Visit: https://huggingface.co/kittendev/YOLOv8m-smoke-detection/resolve/main/best.pt")
    print("2. Download it and save as 'fire_smoke_v8.pt' in the backend folder.")
