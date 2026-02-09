const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());

// Helper to read DB
const readDb = () => {
    if (!fs.existsSync(DB_FILE)) {
        return { deals: [], forecasts: [] };
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    try {
        return JSON.parse(data);
    } catch (e) {
        return { deals: [], forecasts: [] };
    }
};

// Helper to write DB
const writeDb = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
};

// GET Deals
app.get('/api/deals', (req, res) => {
    const db = readDb();
    res.json(db.deals || []);
});

// POST Deals (Save all)
app.post('/api/deals', (req, res) => {
    const db = readDb();
    db.deals = req.body;
    writeDb(db);
    res.json({ success: true, count: db.deals.length });
});

// GET Forecasts
app.get('/api/forecasts', (req, res) => {
    const db = readDb();
    res.json(db.forecasts || []);
});

// POST Forecasts (Save all)
app.post('/api/forecasts', (req, res) => {
    const db = readDb();
    db.forecasts = req.body;
    writeDb(db);
    res.json({ success: true, count: db.forecasts.length });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
