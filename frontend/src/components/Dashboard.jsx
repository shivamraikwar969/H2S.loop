import { useEffect, useState, useRef } from 'react';
import { Activity, Camera, ShieldAlert, Cpu, Video, Download, Expand, Maximize, Play, Pause, ScanFace, Flame, Zap, Settings, X, Globe, Monitor, BarChart3, AlertTriangle, User, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { initAIModels, processVideoFrame } from '../utils/aiDetectionPipeline';

const formatName = (text) =>
  text
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

const playCriticalSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.5);
  } catch(e) {}
};

export default function Dashboard() {
  const [alerts, setAlerts] = useState([]);
  const [cameraList, setCameraList] = useState([1, 2, 3, 4]);
  const [selectedCamera, setSelectedCamera] = useState(1);
  const [configuringCamera, setConfiguringCamera] = useState(null);
  const [realTimeMetrics, setRealTimeMetrics] = useState({});
  const [yoloStatus, setYoloStatus] = useState("DISCONNECTED");

  const [camConfigs, setCamConfigs] = useState({
    1: { type: 'local', url: '', isActive: false, error: '', aiEnabled: true, isConnecting: false },
    2: { type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', isActive: false, error: '', aiEnabled: true, isConnecting: false },
    3: { type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', isActive: false, error: '', aiEnabled: true, isConnecting: false },
    4: { type: 'local', url: '', isActive: false, error: '', aiEnabled: true, isConnecting: false },
  });
  
  const videoRefs = useRef({ 1: null, 2: null, 3: null, 4: null });
  const canvasRefs = useRef({ 1: null, 2: null, 3: null, 4: null });
  const mediaStreams = useRef({ 1: null, 2: null, 3: null, 4: null });
  const lastAlertMap = useRef({});

  useEffect(() => {
    initAIModels();
    // Check YOLOv8 Backend Status
    const checkYOLO = async () => {
        try {
            const res = await fetch("http://localhost:8001/");
            if (res.ok) setYoloStatus("CORE-ONLINE");
        } catch(e) { setYoloStatus("OFFLINE"); }
    };
    checkYOLO();
    const interval = setInterval(checkYOLO, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const analysisInterval = setInterval(async () => {
      const scanPromises = cameraList.map(async (camNum) => {
        const config = camConfigs[camNum];
        if (config?.isActive && config?.aiEnabled && videoRefs.current[camNum]) {
          const video = videoRefs.current[camNum];
          if (video.readyState >= 2) {
            const result = await processVideoFrame(video, camNum);
            if (result) {
              setRealTimeMetrics(prev => ({ ...prev, [camNum]: result }));
              handleInferenceResult(result, camNum);
              drawHUD(result, camNum);
            }
          }
        }
      });
      await Promise.allSettled(scanPromises);
    }, 500); 
    return () => clearInterval(analysisInterval);
  }, [cameraList, camConfigs]);

  const drawHUD = (result, camNum) => {
    const canvas = canvasRefs.current[camNum];
    const video = videoRefs.current[camNum];
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    canvas.width = video.clientWidth; canvas.height = video.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scaleX = canvas.width / video.videoWidth;
    const scaleY = canvas.height / video.videoHeight;

    result.detections.forEach(det => {
        let x, y, width, height;
        
        // Handle different box formats (FaceAPI vs YOLO)
        if (Array.isArray(det.box)) {
            // [x1, y1, x2, y2] format from YOLO
            const [x1, y1, x2, y2] = det.box;
            x = x1; y = y1;
            width = x2 - x1; height = y2 - y1;
        } else {
            // {x, y, width, height} format from FaceAPI
            x = det.box.x; y = det.box.y;
            width = det.box.width; height = det.box.height;
        }

        const isFace = det.type === 'face';
        const color = isFace ? '#b026ff' : '#00f3ff';
        const label = isFace ? 'FACE' : det.type.toUpperCase();
        const score = Math.round(det.score * 100);

        ctx.strokeStyle = color;
        ctx.lineWidth = 2; 
        ctx.strokeRect(x * scaleX, y * scaleY, width * scaleX, height * scaleY);

        // Draw Label & Confidence
        ctx.fillStyle = color;
        ctx.font = "bold 12px 'Outfit'";
        ctx.fillText(`${label} ${score}%`, x * scaleX, (y * scaleY) - 5);
    });

    if (result.fire || result.smoke) {
        const isConfirmed = (result.fire?.confirmed || result.smoke?.confirmed);
        ctx.fillStyle = isConfirmed ? 'rgba(255,42,42,0.2)' : 'rgba(255,165,0,0.1)'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = isConfirmed ? '#ff2a2a' : '#ffa500'; 
        ctx.font = "bold 18px 'Outfit'";
        const statusText = isConfirmed ? '⚠️ YOLO: CONFIRMED ' : '🔍 YOLO: SCANNING ';
        const typeText = result.fire ? 'FIRE' : 'SMOKE';
        ctx.fillText(statusText + typeText, 10, 30);
    }
  };

  const handleInferenceResult = (result, camNum) => {
    if (!result) return;
    const pushAlert = (key, message, severityLevel = 'WARNING', confidence = null) => {
      const now = Date.now();
      const throttleKey = `${camNum}-${key}`;
      const last = lastAlertMap.current[throttleKey] || 0;
      if (now - last > 5000) {
        lastAlertMap.current[throttleKey] = now;
        if (severityLevel === 'CRITICAL') playCriticalSound();
        const confStr = confidence ? `${Math.round(parseFloat(confidence) * 100)}%` : '95%';
        setAlerts(prev => [{ id: now + Math.random(), type: 'YOLOv8 CORE', severity: severityLevel, source: message, camera: `Cam-0${camNum}`, timestamp: now, confidence: confStr }, ...prev].slice(0, 50));
      }
    };

    if (result.fire?.confirmed) pushAlert('fire', `YOLO Confirmed FIRE 🔥`, 'CRITICAL', result.fire.score);
    if (result.smoke?.confirmed) pushAlert('smoke', `YOLO Confirmed SMOKE 💨`, 'CRITICAL', result.smoke.score);
    if (result.fight) pushAlert('fight', `Motion Conflict Alert ⚠️`, 'CRITICAL', 0.95);
  };

  const updateConfig = (camNum, key, value) => {
    setCamConfigs(prev => ({ ...prev, [camNum]: { ...(prev[camNum] || {}), [key]: value } }));
  };

  const toggleCamera = async (camNum) => {
    const config = camConfigs[camNum];
    if (config.isActive) {
      if (mediaStreams.current[camNum]) mediaStreams.current[camNum].getTracks().forEach(track => track.stop());
      updateConfig(camNum, 'isActive', false);
    } else {
      updateConfig(camNum, 'isConnecting', true);
      if (config.type === 'local') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          mediaStreams.current[camNum] = stream;
          updateConfig(camNum, 'isActive', true);
        } catch (err) { updateConfig(camNum, 'error', 'Permission Denied'); }
        finally { updateConfig(camNum, 'isConnecting', false); }
      } else {
        updateConfig(camNum, 'isActive', true);
        setTimeout(() => updateConfig(camNum, 'isConnecting', false), 1000);
      }
    }
  };

  useEffect(() => {
    cameraList.forEach(camNum => {
      const video = videoRefs.current[camNum];
      const stream = mediaStreams.current[camNum];
      if (video && stream && camConfigs[camNum].isActive) video.srcObject = stream;
    });
  });

  return (
    <div className="dashboard-grid relative">
      <header className="dashboard-header">
        <h1 className="title neon-text"><ShieldAlert size={24} className="title-icon" /> Silent Shield Core v4</h1>
        <div className="header-status-group">
            <div className={`status-badge ${yoloStatus === 'CORE-ONLINE' ? 'online' : 'offline'}`}>
                <Database size={14} /> 
                YOLOv8: {yoloStatus}
            </div>
            <div className="status-badge"><span className="dot animate-pulse"></span> Scanning Matrices</div>
        </div>
      </header>
      
      <section className="glass-panel main-viewport">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <h2 className="panel-title"><Video size={18} /> Tactical Matrix</h2>
            <button className="btn-primary mini" onClick={() => {
                const nextCamNum = cameraList.length > 0 ? Math.max(...cameraList) + 1 : 1;
                setCameraList(prev => [...prev, nextCamNum]);
                setCamConfigs(prev => ({
                    ...prev,
                    [nextCamNum]: { type: 'local', url: '', isActive: false, error: '', aiEnabled: true, isConnecting: false }
                }));
            }}>+ Add Camera</button>
        </div>
        <div className="cctv-grid">
          {cameraList.map((camNum) => (
            <motion.div key={camNum} className={`cctv-screen ${selectedCamera === camNum ? 'selected' : ''}`} onClick={() => setSelectedCamera(camNum)}>
                {camConfigs[camNum].isConnecting ? (
                  <div className="cctv-bg"><div className="loading-spinner"></div><span>HANDSHAKE...</span></div>
                ) : camConfigs[camNum].isActive ? (
                  <>
                    <video ref={(el) => { if(el) videoRefs.current[camNum] = el; }} src={camConfigs[camNum].type === 'video' ? camConfigs[camNum].url : undefined} autoPlay playsInline muted loop crossOrigin="anonymous" className="cam-video"/>
                    <canvas ref={(el) => { if(el) canvasRefs.current[camNum] = el; }} className="cam-canvas" />
                    <div className="scanline" />
                  </>
                ) : (
                  <div className="cctv-bg"><Video size={40} opacity={0.2} /><span>{camConfigs[camNum].error || 'LINK SEVERED'}</span><button onClick={() => toggleCamera(camNum)} className="btn-primary mini">Initialize</button></div>
                )}
                <div className="cam-overlay-top">
                   <div className="cam-label">CAM-0{camNum}</div>
                   <button className="cam-btn-mini" onClick={(e) => { e.stopPropagation(); setConfiguringCamera(camNum); }}><Settings size={12} /></button>
                </div>
            </motion.div>
          ))}
        </div>
      </section>
      
      <section className="glass-panel sidebar">
        <div className="analytics-section">
            <h2 className="panel-title"><BarChart3 size={18}/> YOLOv8 Intelligence: Cam-0{selectedCamera}</h2>
            <div className="metrics-card dark-glass">
                <div className="metric-item">
                    <label>YOLO Fire Confidence ({Math.round((realTimeMetrics[selectedCamera]?.fire?.score || 0) * 100)}%)</label>
                    <div className="metric-bar-bg"><motion.div className="metric-bar fire" animate={{ width: `${(realTimeMetrics[selectedCamera]?.fire?.score || 0) * 100}%` }} /></div>
                </div>
                <div className="metric-item">
                    <label>YOLO Smoke Confidence ({Math.round((realTimeMetrics[selectedCamera]?.smoke?.score || 0) * 100)}%)</label>
                    <div className="metric-bar-bg"><motion.div className="metric-bar smoke" animate={{ width: `${(realTimeMetrics[selectedCamera]?.smoke?.score || 0) * 100}%` }} /></div>
                </div>
            </div>
        </div>

        <div className="incident-section">
            <h2 className="panel-title"><ShieldAlert size={18}/> Inference Logs</h2>
            <div className="incident-stream">
              <AnimatePresence>
                {alerts.map((alert) => (
                  <motion.div key={alert.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className={`alert-card ${alert.severity.toLowerCase()}`}>
                    <div className="alert-header">
                       <span className="alert-type">{alert.camera} | {alert.confidence} YOLO</span>
                       <span className="timestamp">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="alert-source">{alert.source}</div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
        </div>
      </section>

      {/* Calibration Modal */}
      <AnimatePresence>
        {configuringCamera && (
            <div className="modal-overlay" onClick={() => setConfiguringCamera(null)}>
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="modal-container dark-glass" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header"><h2>Calibration: Cam-0{configuringCamera}</h2><button onClick={() => setConfiguringCamera(null)} className="close-btn"><X size={18} /></button></div>
                    <div className="config-grid">
                        <div className="source-toggle">
                            <button className={`toggle-btn ${camConfigs[configuringCamera].type === 'local' ? 'active' : ''}`} onClick={() => updateConfig(configuringCamera, 'type', 'local')}>Webcam</button>
                            <button className={`toggle-btn ${camConfigs[configuringCamera].type === 'video' ? 'active' : ''}`} onClick={() => updateConfig(configuringCamera, 'type', 'video')}>URL Stream</button>
                        </div>
                        {camConfigs[configuringCamera].type === 'video' && <input className="config-input" type="text" value={camConfigs[configuringCamera].url} onChange={(e) => updateConfig(configuringCamera, 'url', e.target.value)} />}
                        <button className="btn-primary full" onClick={() => { setConfiguringCamera(null); toggleCamera(configuringCamera); }}>Activate Link</button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}
