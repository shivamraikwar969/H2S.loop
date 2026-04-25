import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import WeatherApp from "./components/WeatherApp";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/weather" element={<WeatherApp />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
