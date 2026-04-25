import { useState, useRef } from "react";
import { Cloud, Sun, Droplets, Wind } from "lucide-react";

export default function WeatherApp() {
  const clickCount = useRef(0);
  const clickTimer = useRef(null);
  const [sosSent, setSosSent] = useState(false);

  const handleSecretTrigger = () => {
    clickCount.current += 1;
    
    if (clickCount.current >= 5) {
        if (!sosSent) triggerSOS();
        clickCount.current = 0;
    }
    
    clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
        clickCount.current = 0;
    }, 1000);
  };

  const triggerSOS = () => {
      const wsUrl = `ws://${window.location.hostname}:8001/ws`;
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {
          ws.send(JSON.stringify({
              type: "trigger_sos",
              timestamp: Date.now() / 1000
          }));
          setSosSent(true);
      };
      
      // Reset text temporarily 
      setTimeout(() => setSosSent(false), 5000);
  };

  return (
    <div className="weather-app">
      <div className="weather-widget">
        <div style={{display: "flex", justifyContent: "center", marginBottom: "10px"}}>
             <Cloud color="#4b5563" size={64} fill="#e5e7eb" />
        </div>
        <h2 style={{fontSize: "24px", fontWeight: "600", margin:"0"}}>London, UK</h2>
        <p style={{fontSize: "16px", color: "#6b7280", margin: "5px 0"}}>Mostly Cloudy</p>
        
        <div className="temp-display" onClick={handleSecretTrigger}>
          18°
        </div>
        
        <div className="weather-details">
           <div style={{display: "flex", alignItems:"center", gap:"8px"}}>
               <Wind size={20}/> 12 mph
           </div>
           <div style={{display: "flex", alignItems:"center", gap:"8px"}}>
               <Droplets size={20}/> 45%
           </div>
           <div style={{display: "flex", alignItems:"center", gap:"8px"}}>
               <Sun size={20}/> 0 UV
           </div>
        </div>
        
        <div className="sync-status">
           {sosSent ? "Updating preferences..." : "Last updated: Just now"}
        </div>
      </div>
    </div>
  );
}
