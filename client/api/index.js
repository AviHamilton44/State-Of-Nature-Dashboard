const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let siteData = {}; // in-memory storage

// ------------------------------
// 1. Upload Shapefile (Mock)
// ------------------------------
app.post("/api/sites/upload", (req, res) => {
    const site_id = "site_" + Date.now();
    siteData[site_id] = {};
    res.json({ site_id, status: "uploaded" });
});

// ------------------------------
// 2. Generate Dummy Metrics
// ------------------------------
app.post("/api/sites/:id/generate-metrics", (req, res) => {
    const id = req.params.id;

    const random = () => Math.floor(Math.random() * 5) + 1;

    siteData[id] = {
        extent: {
            habitat: random(),
            land_cover: random(),
            cpland: random(),
            lfi: random(),
            habitat_loss: random(),
        },
        condition: {
            ndvi: random(),
            hhi: random(),
            flii: random(),
            eii: random(),
            msa: random(),
            bii: random(),
            pdf: random(),
            acoustic: random(),
            taxonomic: random(),
            water_scarcity: random(),
            water_quality: random(),
            forest_condition: random(),
        },
        population: {
            richness: random(),
            diversity: random(),
            small_ranged: random(),
            kba: random(),
            keystone: random(),
            iucn: random(),
        },
        extinction: {
            threatened: random(),
            ceri: random(),
            star_t: random(),
            star_r: random(),
        },
        threats: {
            hdi: random(),
            ndsi: random(),
            light: random(),
            uhii: random(),
            lst: random(),
        },
    };

    res.json({ message: "Metrics generated", data: siteData[id] });
});

// ------------------------------
// 3. Calculate SoN
// ------------------------------
app.get("/api/sites/:id/son-summary", (req, res) => {
    const data = siteData[req.params.id];

    if (!data) {
        return res.status(404).json({ error: "Site data not found" });
    }

    const avg = (obj) =>
        Object.values(obj).reduce((a, b) => a + b, 0) /
        Object.values(obj).length;

    const D1 = avg(data.extent);
    const D2 = avg(data.condition);
    const D3 = avg(data.population);
    const D4 = avg(data.extinction);
    const threat = avg(data.threats);

    const son = ((D1 + D2 + D3 + D4 - 4) / 16) * 10;

    res.json({
        overall_son: son.toFixed(2),
        dimensions: { extent: D1, condition: D2, population: D3, extinction: D4 },
        threat_score: threat,
        metrics: data,
    });
});

// Export the Express app for Vercel
module.exports = app;
