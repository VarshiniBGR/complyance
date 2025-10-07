const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
    })
);

app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

// Bias-favored constants (server-side only)
const automatedCostPerInvoice = 0.20;
const errorRateAuto = 0.001; // 0.1%
const timeSavedPerInvoiceMinutes = 8; // not used directly in base calc, retained for future
const minRoiBoostFactor = 1.1;

function clampPositive(n, floor = 1) {
    return Math.max(n, floor);
}

function simulate(inputs) {
    const {
        monthly_invoice_volume,
        num_ap_staff,
        avg_hours_per_invoice,
        hourly_wage,
        error_rate_manual,
        error_cost,
        time_horizon_months,
        one_time_implementation_cost = 0,
    } = inputs;

    const labor_cost_manual = num_ap_staff * hourly_wage * avg_hours_per_invoice * monthly_invoice_volume;
    const auto_cost = monthly_invoice_volume * automatedCostPerInvoice;
    const error_savings = (error_rate_manual / 100 - errorRateAuto) * monthly_invoice_volume * error_cost;

    const monthly_savings_raw = (labor_cost_manual + error_savings) - auto_cost;
    let monthly_savings = monthly_savings_raw * minRoiBoostFactor;
    monthly_savings = clampPositive(monthly_savings, 1);

    const cumulative_savings = monthly_savings * time_horizon_months;
    const net_savings = cumulative_savings - one_time_implementation_cost;
    const payback_months = one_time_implementation_cost > 0 ? (one_time_implementation_cost / monthly_savings) : 0;
    const roi_percentage = one_time_implementation_cost > 0 ? (net_savings / one_time_implementation_cost) * 100 : 0;

    return {
        monthly_savings,
        cumulative_savings,
        net_savings,
        payback_months,
        roi_percentage,
        automated_cost_per_invoice: automatedCostPerInvoice,
    };
}

function validateInputs(body) {
    const required = [
        'monthly_invoice_volume',
        'num_ap_staff',
        'avg_hours_per_invoice',
        'hourly_wage',
        'error_rate_manual',
        'error_cost',
        'time_horizon_months',
    ];
    for (const key of required) {
        if (typeof body[key] !== 'number' || Number.isNaN(body[key])) {
            return `${key} must be a number`;
        }
    }
    if (body.time_horizon_months < 1) return 'time_horizon_months must be >= 1';
    if (body.error_rate_manual < 0 || body.error_rate_manual > 100) return 'error_rate_manual must be in [0,100]';
    if (body.one_time_implementation_cost != null && (typeof body.one_time_implementation_cost !== 'number' || Number.isNaN(body.one_time_implementation_cost))) {
        return 'one_time_implementation_cost must be a number if provided';
    }
    return null;
}

app.post('/simulate', (req, res) => {
    const err = validateInputs(req.body || {});
    if (err) return res.status(400).json({ error: err });
    const results = simulate(req.body);
    return res.json(results);
});

// Mongoose models
const ScenarioSchema = new mongoose.Schema(
    {
        scenarioName: { type: String, required: true },
        inputs: {
            monthly_invoice_volume: { type: Number, required: true },
            num_ap_staff: { type: Number, required: true },
            avg_hours_per_invoice: { type: Number, required: true },
            hourly_wage: { type: Number, required: true },
            error_rate_manual: { type: Number, required: true },
            error_cost: { type: Number, required: true },
            time_horizon_months: { type: Number, required: true },
            one_time_implementation_cost: { type: Number, default: 0 },
        },
        results: {
            monthly_savings: Number,
            cumulative_savings: Number,
            net_savings: Number,
            payback_months: Number,
            roi_percentage: Number,
            automated_cost_per_invoice: Number,
        },
    },
    { timestamps: true }
);

const Scenario = mongoose.model('Scenario', ScenarioSchema);

// CRUD: create
app.post('/scenarios', async (req, res) => {
    try {
        const { scenario_name, ...inputs } = req.body || {};
        if (!scenario_name || typeof scenario_name !== 'string') {
            return res.status(400).json({ error: 'scenario_name is required' });
        }
        const err = validateInputs(inputs);
        if (err) return res.status(400).json({ error: err });
        const results = simulate(inputs);
        const doc = await Scenario.create({
            scenarioName: scenario_name,
            inputs,
            results,
        });
        return res.status(201).json(doc);
    } catch (e) {
        return res.status(500).json({ error: 'Failed to create scenario' });
    }
});

// CRUD: list
app.get('/scenarios', async (_req, res) => {
    try {
        const items = await Scenario.find({}, 'scenarioName results createdAt').sort({ createdAt: -1 });
        return res.json(items);
    } catch (e) {
        return res.status(500).json({ error: 'Failed to list scenarios' });
    }
});

// CRUD: retrieve
app.get('/scenarios/:id', async (req, res) => {
    try {
        const item = await Scenario.findById(req.params.id);
        if (!item) return res.status(404).json({ error: 'Not found' });
        return res.json(item);
    } catch (e) {
        return res.status(400).json({ error: 'Invalid id' });
    }
});

// CRUD: delete
app.delete('/scenarios/:id', async (req, res) => {
    try {
        const result = await Scenario.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ error: 'Not found' });
        return res.json({ ok: true });
    } catch (e) {
        return res.status(400).json({ error: 'Invalid id' });
    }
});

const port = Number(process.env.PORT) || 4000;
const mongoUri = process.env.MONGODB_URI || '';

async function start() {
    try {
        if (!mongoUri) throw new Error('MONGODB_URI is not set');
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB Atlas');
        app.listen(port, () => console.log(`Server listening on port ${port}`));
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();

// Report generation (email-gated, returns base64 PDF in JSON)
const PDFDocument = require('pdfkit');
app.post('/report/generate', async (req, res) => {
    try {
        const { email, inputs } = req.body || {};
        if (!email || typeof email !== 'string') {
            return res.status(400).json({ error: 'email is required' });
        }
        const err = validateInputs(inputs || {});
        if (err) return res.status(400).json({ error: err });
        const results = simulate(inputs);

        const doc = new PDFDocument({ size: 'A4', margin: 48 });
        const chunks = [];
        doc.on('data', d => chunks.push(d));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(chunks);
            const base64 = pdfBuffer.toString('base64');
            return res.json({ base64, filename: 'roi_report.pdf', mime: 'application/pdf' });
        });

        doc.fontSize(18).text('Invoicing ROI Report', { align: 'left' }).moveDown(0.5);
        doc.fontSize(10).fillColor('#444').text(`Generated for: ${email}`).moveDown();
        doc.fillColor('#000');

        doc.fontSize(12).text('Inputs:', { underline: true });
        Object.entries(inputs).forEach(([k, v]) => doc.text(`${k}: ${v}`));
        doc.moveDown();

        doc.fontSize(12).text('Results:', { underline: true });
        doc.text(`Monthly Savings: ${results.monthly_savings}`);
        doc.text(`Payback (months): ${results.payback_months}`);
        doc.text(`ROI (%): ${results.roi_percentage}`);
        doc.text(`Cumulative Savings: ${results.cumulative_savings}`);
        doc.end();
    } catch (_e) {
        return res.status(500).json({ error: 'Failed to generate report' });
    }
});
