const express = require('express');
const serverless = require('serverless-http');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
let isConnected = false;

const connectToDatabase = async () => {
    if (isConnected) {
        return;
    }

    try {
        const db = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        isConnected = db.connections[0].readyState;
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        throw error;
    }
};

// Mongoose Schemas
const DealSchema = new mongoose.Schema({
    id: String,
    companyName: String,
    type: String, // 'signed' or 'potential'
    dateAdded: String,
    dealMode: String, // 'transfer_price' or 'profit_share'
    isMedinfar: Boolean,
    medinfarCogs: Number,
    royaltyAfterCogs: Boolean,
    dealCurrency: String,
    comparisonCurrency: String,

    // Core Financials
    transferPrice: Number,
    partnerSellingPrice: Number,
    pricingType: String,

    // Profit Share Specific
    profitSharePercent: Number,
    overheadRate: Number,

    // Forecasts
    forecastSales: [Number], // [Y1, Y2, Y3, Y4, Y5]
    countryBreakdown: [{
        id: String,
        country: {
            code: String,
            name: String,
            region: String,
            currency: String
        },
        years: [Number]
    }],

    // Service Fees
    serviceFees: {
        signing: { amount: Number, year: Number },
        approval: { amount: Number, year: Number },
        launch: { amount: Number, year: Number }
    },

    // Royalties
    royalties: [{
        tierLimit: Number,
        rate: Number
    }],
    countries: String // Display string
}, { strict: false }); // Allow flexibility for now

const ForecastSchema = new mongoose.Schema({
    id: String,
    name: String,
    entries: [{
        id: String,
        country: {
            code: String,
            name: String,
            region: String,
            currency: String
        }
    }]
}, { strict: false });

const Deal = mongoose.models.Deal || mongoose.model('Deal', DealSchema);
const Forecast = mongoose.models.Forecast || mongoose.model('Forecast', ForecastSchema);

// API Routes
const router = express.Router();

// GET /api/deals
router.get('/deals', async (req, res) => {
    try {
        await connectToDatabase();
        const deals = await Deal.find({});
        res.json(deals);
    } catch (error) {
        console.error('Error fetching deals:', error);
        res.status(500).json({ error: 'Failed to fetch deals' });
    }
});

// POST /api/deals (Overwrite all - simplified for this app)
router.post('/deals', async (req, res) => {
    try {
        await connectToDatabase();
        // For this simple app, we replace all deals to keep sync simple
        // In a real app, you'd update individual items
        await Deal.deleteMany({});
        if (req.body.length > 0) {
            await Deal.insertMany(req.body);
        }
        res.json({ success: true, count: req.body.length });
    } catch (error) {
        console.error('Error saving deals:', error);
        res.status(500).json({ error: 'Failed to save deals' });
    }
});

// GET /api/forecasts
router.get('/forecasts', async (req, res) => {
    try {
        await connectToDatabase();
        const forecasts = await Forecast.find({});
        res.json(forecasts);
    } catch (error) {
        console.error('Error fetching forecasts:', error);
        res.status(500).json({ error: 'Failed to fetch forecasts' });
    }
});

// POST /api/forecasts
router.post('/forecasts', async (req, res) => {
    try {
        await connectToDatabase();
        await Forecast.deleteMany({});
        if (req.body.length > 0) {
            await Forecast.insertMany(req.body);
        }
        res.json({ success: true, count: req.body.length });
    } catch (error) {
        console.error('Error saving forecasts:', error);
        res.status(500).json({ error: 'Failed to save forecasts' });
    }
});

// Mount router at /api
app.use('/api', router); // Local express usage
app.use('/.netlify/functions/api', router); // Netlify usage

module.exports.handler = serverless(app);
