import { useState, useEffect, useMemo } from 'react';
import { type Currency, type FXRates, fetchFXRates, convertPrice } from './utils/fx';
import { calculateProfit } from './utils/calculator';
import { TrendingUp, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
    const [rates, setRates] = useState<FXRates | null>(null);
    const [currency, setCurrency] = useState<Currency>('EUR');
    const [transferPriceInput, setTransferPriceInput] = useState<string>('5.00');
    const [forecastSalesInput, setForecastSalesInput] = useState<string>('50000');

    useEffect(() => {
        fetchFXRates().then(setRates);
    }, []);

    const transferPriceInEUR = useMemo(() => {
        if (!rates) return parseFloat(transferPriceInput) || 0;
        return convertPrice(parseFloat(transferPriceInput) || 0, currency, 'EUR', rates);
    }, [transferPriceInput, currency, rates]);

    const forecastSales = parseFloat(forecastSalesInput) || 0;

    const results = useMemo(() => {
        return calculateProfit(transferPriceInEUR, forecastSales);
    }, [transferPriceInEUR, forecastSales]);

    const formatCurrency = (amount: number, curr: Currency = currency) => {
        // Convert from EUR if requested in another currency
        let displayAmount = amount;
        if (rates && curr !== 'EUR') {
            displayAmount = convertPrice(amount, 'EUR', curr, rates);
        }

        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: curr,
        }).format(displayAmount);
    };

    const currencySymbols: Record<Currency, string> = {
        EUR: '€',
        GBP: '£',
        USD: '$',
    };

    if (!rates) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="app-card"
        >
            <header>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <TrendingUp size={32} color="var(--primary)" />
                    <h1>Anatop Pricing</h1>
                </div>
                <p className="subtitle">SLA Pharma Transfer Price & Profit Calculator</p>
            </header>

            <div className="grid">
                <div className="input-section">
                    <div className="form-group">
                        <label>Input Currency</label>
                        <div className="currency-toggle">
                            {(['GBP', 'EUR', 'USD'] as Currency[]).map((c) => (
                                <button
                                    key={c}
                                    className={`currency-btn ${currency === c ? 'active' : ''}`}
                                    onClick={() => setCurrency(c)}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Proposed Transfer Price</label>
                        <div className="input-wrapper">
                            <span className="currency-symbol">{currencySymbols[currency]}</span>
                            <input
                                type="number"
                                step="0.01"
                                value={transferPriceInput}
                                onChange={(e) => setTransferPriceInput(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                            Base: {formatCurrency(transferPriceInEUR, 'EUR')}
                        </p>
                    </div>

                    <div className="form-group">
                        <label>Forecast Annual Sales (Units)</label>
                        <div className="input-wrapper">
                            <span className="currency-symbol" style={{ left: '0.8rem' }}><Package size={16} /></span>
                            <input
                                style={{ paddingLeft: '2.5rem' }}
                                type="number"
                                value={forecastSalesInput}
                                onChange={(e) => setForecastSalesInput(e.target.value)}
                                placeholder="0"
                            />
                        </div>
                        <motion.div
                            key={results.cogsPerUnit}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="cogs-badge"
                        >
                            COGS tier: {formatCurrency(results.cogsPerUnit, 'EUR')} / unit
                        </motion.div>
                    </div>
                </div>

                <div className="results-panel">
                    <label>Profitability Analysis</label>
                    <div className="results-section">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={`${transferPriceInput}-${forecastSalesInput}-${currency}`}
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="result-item">
                                    <span className="label">Total Revenue</span>
                                    <span className="value">{formatCurrency(results.totalRevenue)}</span>
                                </div>
                                <div className="result-item">
                                    <span className="label">Total COGS</span>
                                    <span className="value">{formatCurrency(results.totalCogs)}</span>
                                </div>
                                <div className="result-item">
                                    <span className="label">Total Royalties</span>
                                    <span className="value" style={{ color: 'var(--danger)' }}>
                                        -{formatCurrency(results.totalRoyalties)}
                                    </span>
                                </div>

                                <div className="royalty-list">
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '8px', fontWeight: 600 }}>
                                        Royalty Cascade Breakdown
                                    </p>
                                    {results.royalties.map((r, i) => (
                                        <motion.div
                                            key={r.name}
                                            className="royalty-item"
                                            initial={{ opacity: 0, x: -5 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                        >
                                            <span>{r.name} ({r.rate * 100}%)</span>
                                            <span className="val">{formatCurrency(r.amount)}</span>
                                        </motion.div>
                                    ))}
                                </div>

                                <div className="result-item main">
                                    <span className="label" style={{ color: 'var(--text)' }}>Net Profit</span>
                                    <span className="value">{formatCurrency(results.netProfit)}</span>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                    <div className="stats-box" style={{ flex: 1, textAlign: 'center' }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '4px' }}>Profit per Unit</p>
                                        <p style={{ fontWeight: 800, fontSize: '1.1rem' }}>{formatCurrency(results.profitPerUnit)}</p>
                                    </div>
                                    <div className="stats-box" style={{ flex: 1, textAlign: 'center' }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '4px' }}>Profit Margin</p>
                                        <p style={{ fontWeight: 800, fontSize: '1.1rem', color: results.profitMargin > 20 ? 'var(--success)' : results.profitMargin > 0 ? 'var(--text)' : 'var(--danger)' }}>
                                            {results.profitMargin.toFixed(1)}%
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

export default App;
