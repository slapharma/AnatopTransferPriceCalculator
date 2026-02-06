import { useState, useEffect, useMemo, useRef } from 'react';
import { type Currency, type FXRates, fetchFXRates, convertPrice } from './utils/fx';
import { calculateProfit, DEFAULT_ROYALTIES, type RoyaltyTier } from './utils/calculator';
import { Package, FileDown, Settings, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function App() {
    const [rates, setRates] = useState<FXRates | null>(null);
    const [currency, setCurrency] = useState<Currency>('EUR');
    const [transferPriceInput, setTransferPriceInput] = useState<string>('5.00');
    const [forecastSalesInput, setForecastSalesInput] = useState<string>('50000');

    // Phase 2 State
    const [supplier, setSupplier] = useState<'CPM' | 'Medinfar'>('CPM');
    const [medinfarCogsInput, setMedinfarCogsInput] = useState<string>('1.50');
    const [royaltyAfterCogs, setRoyaltyAfterCogs] = useState<boolean>(false);
    const [royalties, setRoyalties] = useState<RoyaltyTier[]>(DEFAULT_ROYALTIES);

    const reportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchFXRates().then(setRates);
    }, []);

    const transferPriceInEUR = useMemo(() => {
        if (!rates) return parseFloat(transferPriceInput) || 0;
        return convertPrice(parseFloat(transferPriceInput) || 0, currency, 'EUR', rates);
    }, [transferPriceInput, currency, rates]);

    const forecastSales = parseFloat(forecastSalesInput) || 0;

    const medinfarCogsInEUR = useMemo(() => {
        if (!rates) return parseFloat(medinfarCogsInput) || 0;
        return convertPrice(parseFloat(medinfarCogsInput) || 0, currency, 'EUR', rates);
    }, [medinfarCogsInput, currency, rates]);

    const results = useMemo(() => {
        const customCogs = supplier === 'Medinfar' ? medinfarCogsInEUR : null;
        return calculateProfit(transferPriceInEUR, forecastSales, royaltyAfterCogs, customCogs, royalties);
    }, [transferPriceInEUR, forecastSales, royaltyAfterCogs, supplier, medinfarCogsInEUR, royalties]);

    const formatCurrency = (amount: number, curr: Currency = currency) => {
        let displayAmount = amount;
        if (rates && curr !== 'EUR') {
            displayAmount = convertPrice(amount, 'EUR', curr, rates);
        }

        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: curr,
        }).format(displayAmount);
    };

    const handleRoyaltyChange = (index: number, newRate: string) => {
        const rate = parseFloat(newRate) / 100;
        if (isNaN(rate)) return;
        const newRoyalties = [...royalties];
        newRoyalties[index] = { ...newRoyalties[index], rate };
        setRoyalties(newRoyalties);
    };

    const downloadPDF = async () => {
        if (!reportRef.current) return;

        const canvas = await html2canvas(reportRef.current, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Anatop_Pricing_Report_${new Date().toISOString().split('T')[0]}.pdf`);
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
        <div className="app-card" ref={reportRef}>
            <div className="header-flex">
                <div>
                    <img src="/logo.png" alt="SLA Pharma Logo" className="logo-img" />
                    <h1>Anatop Pricing Calculator</h1>
                    <p className="subtitle">Global Transfer Price & Profit Analysis</p>
                </div>
                <div className="currency-toggle">
                    {(['GBP', 'EUR', 'USD'] as Currency[]).map((c) => (
                        <button
                            key={c}
                            className={`toggle-btn ${currency === c ? 'active' : ''}`}
                            onClick={() => setCurrency(c)}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid">
                <div className="input-section">
                    <div className="card-title">
                        <Settings size={18} /> Configuration
                    </div>

                    <div className="form-group">
                        <label>Proposed Transfer Price ({currency})</label>
                        <div className="input-wrapper">
                            <span className="currency-symbol">{currencySymbols[currency]}</span>
                            <input
                                type="number"
                                step="0.01"
                                value={transferPriceInput}
                                onChange={(e) => setTransferPriceInput(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Forecast Annual Sales (Units)</label>
                        <div className="input-wrapper">
                            <span className="currency-symbol" style={{ left: '0.75rem' }}><Package size={16} /></span>
                            <input
                                style={{ paddingLeft: '2.5rem' }}
                                type="number"
                                value={forecastSalesInput}
                                onChange={(e) => setForecastSalesInput(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Supplier / COGS Mode</label>
                        <div className="toggle-group">
                            <button
                                className={`toggle-btn ${supplier === 'CPM' ? 'active' : ''}`}
                                onClick={() => setSupplier('CPM')}
                            >
                                CPM (Tiered)
                            </button>
                            <button
                                className={`toggle-btn ${supplier === 'Medinfar' ? 'active' : ''}`}
                                onClick={() => setSupplier('Medinfar')}
                            >
                                Medinfar (Manual)
                            </button>
                        </div>
                        {supplier === 'Medinfar' && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="input-wrapper"
                                style={{ marginTop: '8px' }}
                            >
                                <span className="currency-symbol">{currencySymbols[currency]}</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={medinfarCogsInput}
                                    onChange={(e) => setMedinfarCogsInput(e.target.value)}
                                    placeholder="Enter custom COGS"
                                />
                            </motion.div>
                        )}
                        {supplier === 'CPM' && (
                            <div className="payment-badge" style={{ marginTop: '8px', width: 'fit-content' }}>
                                Tiered COGS: {formatCurrency(results.cogsPerUnit, 'EUR')} / unit (EUR base)
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Royalty Logic Base</label>
                        <div className="toggle-group">
                            <button
                                className={`toggle-btn ${!royaltyAfterCogs ? 'active' : ''}`}
                                onClick={() => setRoyaltyAfterCogs(false)}
                            >
                                On Transfer Price
                            </button>
                            <button
                                className={`toggle-btn ${royaltyAfterCogs ? 'active' : ''}`}
                                onClick={() => setRoyaltyAfterCogs(true)}
                            >
                                On (TP - COGS)
                            </button>
                        </div>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                            Base for calculation: {formatCurrency(royaltyAfterCogs ? Math.max(0, results.transferPricePerUnit - results.cogsPerUnit) : results.transferPricePerUnit, 'EUR')} (EUR)
                        </p>
                    </div>
                </div>

                <div className="results-panel">
                    <div className="card-title">
                        <Info size={18} /> Financial Breakdown
                    </div>

                    <table className="results-table">
                        <thead>
                            <tr>
                                <th>Royalty Recipient</th>
                                <th style={{ textAlign: 'center' }}>% Rate</th>
                                <th style={{ textAlign: 'right' }}>Payment / Unit</th>
                                <th style={{ textAlign: 'right' }}>Annual Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.royalties.map((r, i) => (
                                <tr key={r.name} className="royalty-row">
                                    <td>{r.name}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <input
                                            className="editable-pct"
                                            type="number"
                                            step="0.1"
                                            value={r.rate * 100}
                                            onChange={(e) => handleRoyaltyChange(i, e.target.value)}
                                        />%
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <span className="payment-badge">{formatCurrency(r.perUnit)}</span>
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                        {formatCurrency(r.amount)}
                                    </td>
                                </tr>
                            ))}
                            <tr>
                                <td colSpan={3} style={{ fontWeight: 600, color: 'var(--text-dim)' }}>Total Royalties</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>
                                    {formatCurrency(results.totalRoyalties)}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="net-profit-card">
                        <div>
                            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Annual Net Profit</p>
                            <h2 className="net-profit-val">{formatCurrency(results.netProfit)}</h2>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Margin</p>
                            <h2 style={{ color: results.profitMargin > 20 ? 'var(--success)' : 'var(--text)', fontSize: '1.5rem', fontWeight: 800 }}>
                                {results.profitMargin.toFixed(1)}%
                            </h2>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                        <div className="payment-badge" style={{ padding: '1rem', textAlign: 'center', background: '#fff' }}>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Revenue</p>
                            <p style={{ fontWeight: 700 }}>{formatCurrency(results.totalRevenue)}</p>
                        </div>
                        <div className="payment-badge" style={{ padding: '1rem', textAlign: 'center', background: '#fff' }}>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Total COGS</p>
                            <p style={{ fontWeight: 700 }}>{formatCurrency(results.totalCogs)}</p>
                        </div>
                    </div>

                    <div className="actions">
                        <button className="btn-primary" onClick={downloadPDF}>
                            <FileDown size={18} /> Download PDF Report
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
