import { useState } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  Tooltip
} from 'recharts';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { Leaf, AlertTriangle, Activity, BarChart2, Map as MapIcon, Droplet, Wind, Sun, ShieldAlert, Zap, Box, ChevronDown, ChevronUp, Info } from 'lucide-react';
import './Dashboard.css';

const SCORE_COLORS = {
  high: 'var(--color-score-high)',
  mid: 'var(--color-score-mid)',
  low: 'var(--color-score-low)'
};

const getScoreColor = (score) => {
  if (score >= 7.5) return SCORE_COLORS.high;
  if (score >= 4.0) return SCORE_COLORS.mid;
  return SCORE_COLORS.low;
};

const getMetricIcon = (name) => {
  const n = name.toLowerCase();
  if (n.includes('water') || n.includes('rain') || n.includes('aquatic')) return <Droplet size={16} color="var(--primary)" />;
  if (n.includes('air') || n.includes('wind') || n.includes('pollution')) return <Wind size={16} color="var(--dim-extent)" />;
  if (n.includes('sun') || n.includes('temp') || n.includes('climate')) return <Sun size={16} color="var(--color-score-mid)" />;
  if (n.includes('risk') || n.includes('threat') || n.includes('loss')) return <ShieldAlert size={16} color="var(--dim-threat)" />;
  if (n.includes('energy') || n.includes('power')) return <Zap size={16} color="var(--color-score-high)" />;
  return <Box size={16} color="var(--text-secondary)" />;
};

const getMetricGrade = (val, groupName) => {
  const num = parseFloat(val);
  if (isNaN(num)) return { label: 'Unknown', class: '' };

  // Threat and Extinction are negative indicators. Higher = Worse.
  const isNegativeIndicator = groupName === 'threats' || groupName === 'extinction';

  if (isNegativeIndicator) {
    if (num <= 2.0) return { label: 'Good', class: 'badge-good' };
    if (num <= 3.5) return { label: 'Medium', class: 'badge-medium' };
    return { label: 'Poor', class: 'badge-poor' };
  } else {
    if (num <= 2.0) return { label: 'Poor', class: 'badge-poor' };
    if (num <= 3.5) return { label: 'Medium', class: 'badge-medium' };
    return { label: 'Good', class: 'badge-good' };
  }
};

// Calculate geodesic area in km2 for WGS84 GeoJSON
const getRingArea = (coords) => {
  let area = 0;
  if (coords && coords.length > 2) {
    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const dLon = (p2[0] - p1[0]) * Math.PI / 180;
      area += dLon * (2 + Math.sin(p1[1] * Math.PI / 180) + Math.sin(p2[1] * Math.PI / 180));
    }
    area = Math.abs(area * 6378.137 * 6378.137 / 2.0);
  }
  return area;
};

const getFeatureAreaKm2 = (feature) => {
  let area = 0;
  if (!feature.geometry || !feature.geometry.coordinates) return null;

  if (feature.geometry.type === 'Polygon') {
    area = getRingArea(feature.geometry.coordinates[0]);
    for (let i = 1; i < feature.geometry.coordinates.length; i++) {
      area -= getRingArea(feature.geometry.coordinates[i]);
    }
  } else if (feature.geometry.type === 'MultiPolygon') {
    feature.geometry.coordinates.forEach(polygon => {
      let polyArea = getRingArea(polygon[0]);
      for (let i = 1; i < polygon.length; i++) {
        polyArea -= getRingArea(polygon[i]);
      }
      area += polyArea;
    });
  }
  return Math.abs(area);
};

export default function Dashboard({ data, geoJson, onReset }) {
  const [mapType, setMapType] = useState('base');
  const [expandedGroup, setExpandedGroup] = useState(null);

  if (!data) return null;

  const tileUrls = {
    base: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    street: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  };

  const { overall_son, dimensions, threat_score, metrics } = data;
  const sonValue = parseFloat(overall_son);
  const threatValue = parseFloat(threat_score);

  let bounds = null;
  try {
    if (geoJson) bounds = L.geoJSON(geoJson).getBounds();
  } catch (e) {
    console.warn("Could not calculate bounds for GeoJSON");
  }

  const onEachFeature = (feature, layer) => {
    if (feature.properties) {
      let tooltipContent = '';

      const tryKeys = (keys, label) => {
        for (let k of keys) {
          if (feature.properties[k] !== undefined && feature.properties[k] !== null) {
            tooltipContent += `<strong>${label}:</strong> ${feature.properties[k]}<br/>`;
            return;
          }
        }
      };

      tryKeys(['Name', 'NAME', 'name'], 'Name');

      const realArea = getFeatureAreaKm2(feature);
      if (realArea !== null && realArea > 0) {
        let displayArea = Math.round(realArea).toLocaleString();
        if (Math.round(realArea) === 0 && realArea > 0) displayArea = "< 1";
        tooltipContent += `<strong>Area:</strong> ${displayArea} km²<br/>`;
      } else {
        tryKeys(['Area', 'AREA', 'area', 'Shape_Area'], 'Area');
      }

      if (!tooltipContent && Object.keys(feature.properties).length > 0) {
        const keys = Object.keys(feature.properties).slice(0, 3);
        keys.forEach(k => {
          tooltipContent += `<strong>${k}:</strong> ${feature.properties[k]}<br/>`;
        });
      }

      if (tooltipContent) {
        layer.bindTooltip(`<div class="map-tooltip" style="font-family: inherit; color: var(--text-primary);">${tooltipContent}</div>`, { permanent: false, direction: 'auto', sticky: true });
      }
    }
  };

  const radarData = [
    { subject: 'Extent', A: dimensions.extent, fullMark: 5 },
    { subject: 'Condition', A: dimensions.condition, fullMark: 5 },
    { subject: 'Population', A: dimensions.population, fullMark: 5 },
    { subject: 'Extinction', A: dimensions.extinction, fullMark: 5 },
  ];

  const dimColors = {
    Extent: 'var(--dim-extent)',
    Condition: 'var(--dim-condition)',
    Population: 'var(--dim-population)',
    Extinction: 'var(--dim-extinction)',
  };

  const barData = Object.keys(dimColors).map(key => ({
    name: key,
    score: dimensions[key.toLowerCase()].toFixed(1)
  }));

  const mainColor = getScoreColor(sonValue);

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title text-gradient">Area Profile</h1>
          <p>Analysis complete. Viewing calculated metrics.</p>
        </div>
        <button className="btn-primary" onClick={onReset}>
          Analyze New Area
        </button>
      </div>

      <div className="dashboard-grid">

        {/* Map Card */}
        <div className="glass-panel card-map" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <MapIcon size={20} color="var(--primary)" />
              <h3 className="card-title">Map Visualization</h3>
            </div>
            <select
              value={mapType}
              onChange={(e) => setMapType(e.target.value)}
              style={{
                padding: '0.5rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(0,0,0,0.1)',
                background: 'var(--bg-surface-elevated)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                outline: 'none'
              }}
            >
              <option value="base">Base Map</option>
              <option value="satellite">Satellite Imagery</option>
              <option value="street">Street Map</option>
            </select>
          </div>
          <div className="map-container-wrapper">
            {bounds && bounds.isValid() ? (
              <MapContainer bounds={bounds} style={{ height: '100%', width: '100%', backgroundColor: '#0B0E14' }} zoomControl={true}>
                <TileLayer
                  url={tileUrls[mapType]}
                  attribution='Map data providers'
                />
                <GeoJSON data={geoJson} style={{ color: '#10B981', weight: 2, fillOpacity: 0.2 }} onEachFeature={onEachFeature} />
              </MapContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                No valid geometry found for visualization.
              </div>
            )}
          </div>
        </div>

        {/* 1. Dimension Balance Radar Chart */}
        <div className="glass-panel card-radar-chart" style={{ padding: '1.5rem' }}>
          <div className="card-header">
            <Activity size={20} color="var(--primary)" />
            <h3 className="card-title">Dimension Balance</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="rgba(0,0,0,0.1)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                <Radar name="Area" dataKey="A" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.4} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-surface-elevated)', border: 'none', borderRadius: '8px', color: 'var(--text-primary)' }}
                  itemStyle={{ color: 'var(--primary)' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Threat Score Card */}
        <div className="glass-panel card-threat-score score-card">
          <AlertTriangle size={32} color="var(--dim-threat)" style={{ marginBottom: '1rem' }} />
          <h2 className="score-label">Threat Intensity</h2>
          <div className="score-value-wrapper" style={{ boxShadow: `0 0 40px var(--dim-threat)40, inset 0 4px 20px rgba(0,0,0,0.05)` }}>
            <span className="score-value" style={{ color: 'var(--dim-threat)' }}>{threatValue.toFixed(1)}</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Higher score indicates elevated risk.</p>
        </div>

        {/* 3. Main State of Nature Score Card */}
        <div className="glass-panel card-main-score score-card">
          <Leaf size={32} color={mainColor} style={{ marginBottom: '1rem' }} />
          <h2 className="score-label">State of Nature</h2>
          <div className="score-value-wrapper" style={{ boxShadow: `0 0 40px ${mainColor}40, inset 0 4px 20px rgba(0,0,0,0.05)` }}>
            <svg style={{ position: 'absolute', width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="80" cy="80" r="76" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="8" />
              <circle cx="80" cy="80" r="76" fill="none" stroke={mainColor} strokeWidth="8"
                strokeDasharray="477" strokeDashoffset={477 - (477 * (sonValue / 10))}
                style={{ transition: 'stroke-dashoffset 1.5s ease-out' }} />
            </svg>
            <span className="score-value" style={{ color: mainColor }}>{sonValue}</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Scale: 0.0 - 10.0</p>
        </div>

        {/* Detailed Metrics Grid */}
        <div className="glass-panel card-metrics" style={{ padding: '2rem' }}>
          <div className="card-header">
            <BarChart2 size={24} color="var(--text-primary)" />
            <h3 className="card-title" style={{ fontSize: '1.25rem' }}>Detailed Metrics</h3>
          </div>

          {Object.entries(metrics).map(([groupName, groupData]) => {
            const isExpanded = expandedGroup === groupName;
            return (
              <div key={groupName} className="metrics-section" style={{ marginBottom: '0.25rem' }}>
                <div
                  className="accordion-header"
                  onClick={() => setExpandedGroup(isExpanded ? null : groupName)}
                >
                  <div className="accordion-title">
                    {groupName} Parameters
                  </div>
                  {isExpanded ? <ChevronUp size={20} color="var(--text-secondary)" /> : <ChevronDown size={20} color="var(--text-secondary)" />}
                </div>

                <div className={`accordion-content ${isExpanded ? 'expanded' : ''}`}>
                  <div className="metrics-list">
                    {Object.entries(groupData).map(([metricName, metricValue]) => {
                      const grade = getMetricGrade(metricValue, groupName);
                      return (
                        <div key={metricName} className="metric-item">
                          <span className="metric-name" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {getMetricIcon(metricName)}
                            <span>{metricName.replace(/_/g, ' ')}</span>
                            <Info
                              size={14}
                              color="var(--text-muted)"
                              style={{ cursor: 'help' }}
                              title={`Calculated parameter indexing algorithm value for ${metricName.replace(/_/g, ' ')}. Indicates current health standard.`}
                            />
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span className={`metric-badge ${grade.class}`}>{grade.label}</span>
                            <span className="metric-val" style={{ width: '40px', textAlign: 'right' }}>{parseFloat(metricValue).toFixed(2)}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

        </div>

      </div>
    </div>
  );
}
