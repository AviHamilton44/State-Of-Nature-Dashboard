import React, { useState } from 'react';
import axios from 'axios';
import { Compass } from 'lucide-react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import shp from 'shpjs';
import darukaaLogo from './assets/Darukaa1.png';

import './App.css';

// Mock delays for better UX
const delay = (ms) => new Promise(res => setTimeout(res, ms));

function App() {
  const [appState, setAppState] = useState('idle'); // 'idle', 'uploading', 'analyzing', 'calculating', 'results'
  const [data, setData] = useState(null);
  const [geoJson, setGeoJson] = useState(null);

  const handleUpload = async (file) => {
    try {
      setAppState('uploading');
      
      // Parse Shapefile or GeoJSON locally to display on map
      try {
        if (file.name.endsWith('.geojson') || file.name.endsWith('.json')) {
          const text = await file.text();
          setGeoJson(JSON.parse(text));
        } else {
          const arrayBuffer = await file.arrayBuffer();
          const geoData = await shp(arrayBuffer);
          setGeoJson(geoData);
        }
      } catch (err) {
        console.warn('Could not parse shapefile client-side:', err);
      }

      // 1. Upload Shapefile
      const formData = new FormData();
      formData.append('file', file);
      // Simulating a real upload even though backend just returns mock JSON
      await delay(1000); 
      const uploadRes = await axios.post('/api/sites/upload', formData);
      const { site_id } = uploadRes.data;

      // 2. Generate Metrics
      setAppState('analyzing');
      await delay(1500);
      await axios.post(`/api/sites/${site_id}/generate-metrics`);

      // 3. Get SoN Summary
      setAppState('calculating');
      await delay(1000);
      const summaryRes = await axios.get(`/api/sites/${site_id}/son-summary`);
      
      setData(summaryRes.data);
      setAppState('results');

    } catch (error) {
      console.error("Error processing file:", error);
      alert("An error occurred during analysis. Make sure backend is running on port 5000.");
      setAppState('idle');
    }
  };

  const resetApp = () => {
    setData(null);
    setGeoJson(null);
    setAppState('idle');
  };

  const renderLoadingState = () => {
    let message = "Processing...";
    if (appState === 'uploading') message = "Uploading spatial data...";
    if (appState === 'analyzing') message = "Analyzing environmental matrices...";
    if (appState === 'calculating') message = "Calculating State of Nature score...";

    return (
      <div className="loading-container">
        <div className="loading-spinner-wrapper">
          <div className="loading-ring animate-spin"></div>
          <Compass size={32} color="var(--primary)" />
        </div>
        <p className="loading-text">{message}</p>
      </div>
    );
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-icon">
            <img src={darukaaLogo} alt="Darukaa Logo" />
          </div>
          <div>
            <h1 className="app-subtitle" style={{ fontSize: '1rem', fontWeight: '500' }}>State of Nature Dashboard</h1>
          </div>
        </div>
        
        {appState === 'results' && (
           <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Status</div>
              <div style={{ color: 'var(--color-score-high)', fontWeight: '600' }}>Analysis complete</div>
           </div>
        )}
      </header>

      <main className="main-content">
        {appState === 'idle' && <FileUpload onUpload={handleUpload} />}
        
        {(appState === 'uploading' || appState === 'analyzing' || appState === 'calculating') && renderLoadingState()}
        
        {appState === 'results' && <Dashboard data={data} geoJson={geoJson} onReset={resetApp} />}
      </main>
    </div>
  );
}

export default App;