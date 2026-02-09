import { useState, useEffect, useMemo, useRef } from 'react';
import { type Currency, type FXRates, fetchFXRates, convertPrice } from './utils/fx';
import { calculateProfit, DEFAULT_ROYALTIES, type RoyaltyTier } from './utils/calculator';
import { Package, FileDown, Settings, Info, Lock, Briefcase, History, Trash2, Edit, Save, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Deal {
    id: string;
    companyName: string;
    countries: string;
    initialServiceFee: number;
    totalServiceFee: number;
    currency: Currency;
    transferPrice: number;
    forecastSales: number;
    supplier: 'CPM' | 'Medinfar';
    medinfarCogs: number;
    includesCogs: boolean;
    royalties: RoyaltyTier[];
    type: 'signed' | 'potential';
    date: string;
}

function App() {
    const [rates, setRates] = useState<FXRates | null>(null);
    const [currency, setCurrency] = useState<Currency>('EUR');
    const [transferPriceInput, setTransferPriceInput] = useState<string>('5.00');
    const [forecastSalesInput, setForecastSalesInput] = useState<string>('50000');

    // Password State
    const [password, setPassword] = useState('');
    const [isAuthorized, setIsAuthorized] = useState(false);

    // Navigation State
    const [activeTab, setActiveTab] = useState<'signed' | 'potential' | 'calculate'>('calculate');

    // Deals State
    const [deals, setDeals] = useState<Deal[]>([]);
    const [editingDealId, setEditingDealId] = useState<string | null>(null);

    // Calculator Extra Fields
    const [companyName, setCompanyName] = useState('');
    const [countries, setCountries] = useState('');
    const [initialServiceFee, setInitialServiceFee] = useState('');
    const [totalServiceFee, setTotalServiceFee] = useState('');

    // Phase 2 State
    const [supplier, setSupplier] = useState<'CPM' | 'Medinfar'>('CPM');
    const [medinfarCogsInput, setMedinfarCogsInput] = useState<string>('1.50');
    const [royaltyAfterCogs, setRoyaltyAfterCogs] = useState<boolean>(false);
    const [royalties, setRoyalties] = useState<RoyaltyTier[]>(DEFAULT_ROYALTIES);

    const reportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchFXRates().then(setRates);

        // Load Deals
        const savedDeals = localStorage.getItem('anatop_deals');
        if (savedDeals) {
            setDeals(JSON.parse(savedDeals));
        }

        // Check Auth session
        const auth = sessionStorage.getItem('anatop_auth');
        if (auth === 'true') {
            setIsAuthorized(true);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('anatop_deals', JSON.stringify(deals));
    }, [deals]);

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === 'antop2026') {
            setIsAuthorized(true);
            sessionStorage.setItem('anatop_auth', 'true');
        } else {
            alert('Incorrect password');
        }
    };

    const addDeal = (type: 'signed' | 'potential') => {
        const newDeal: Deal = {
            id: Date.now().toString(),
            companyName: companyName || 'Unnamed Company',
            countries: countries || 'N/A',
            initialServiceFee: parseFloat(initialServiceFee) || 0,
            totalServiceFee: parseFloat(totalServiceFee) || 0,
            currency: currency,
            transferPrice: parseFloat(transferPriceInput) || 0,
            forecastSales: parseFloat(forecastSalesInput) || 0,
            supplier: supplier,
            medinfarCogs: parseFloat(medinfarCogsInput) || 0,
            includesCogs: royaltyAfterCogs,
            royalties: [...royalties],
            type: type,
            date: new Date().toLocaleDateString()
        };
        setDeals([...deals, newDeal]);
        setActiveTab(type);
        // Clear fields
        setCompanyName('');
        setCountries('');
        setInitialServiceFee('');
        setTotalServiceFee('');
    };

    const deleteDeal = (id: string) => {
        if (window.confirm('Are you sure you want to delete this deal?')) {
            setDeals(deals.filter(d => d.id !== id));
        }
    };

    const updateDeal = (id: string, field: keyof Deal, value: any) => {
        setDeals(deals.map(d => d.id === id ? { ...d, [field]: value } : d));
    };

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

    const downloadPDF = async (targetRef: React.RefObject<HTMLDivElement>, filename: string) => {
        if (!targetRef.current) return;

        const canvas = await html2canvas(targetRef.current, {
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
        pdf.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
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

    if (!isAuthorized) {
        return (
            <div className="password-overlay">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="password-card"
                >
                    <Lock size={48} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                    <h2>ANATOP Pipeline</h2>
                    <p style={{ marginBottom: '1.5rem', color: 'var(--text-dim)' }}>Please enter password to continue</p>
                    <form onSubmit={handlePasswordSubmit}>
                        <div className="password-input">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                autoFocus
                            />
                        </div>
                        <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                            Access Dashboard
                        </button>
                    </form>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="app-card">
            <div className="header-flex">
                <div>
                    <img src="/logo.png" alt="SLA Pharma Logo" className="logo-img" />
                    <h1>ANATOP Deal Pipeline</h1>
                    <p className="subtitle">Global Deal Management & Analysis</p>
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

            <nav className="tabs-nav">
                <button
                    className={`tab-btn ${activeTab === 'calculate' ? 'active' : ''}`}
                    onClick={() => setActiveTab('calculate')}
                >
                    <Plus size={18} /> Calculate New Deal
                </button>
                <button
                    className={`tab-btn ${activeTab === 'signed' ? 'active' : ''}`}
                    onClick={() => setActiveTab('signed')}
                >
                    <Briefcase size={18} /> Signed Deals
                </button>
                <button
                    className={`tab-btn ${activeTab === 'potential' ? 'active' : ''}`}
                    onClick={() => setActiveTab('potential')}
                >
                    <History size={18} /> Potential Deals
                </button>
            </nav>

            <AnimatePresence mode="wait">
                {activeTab === 'calculate' && (
                    <motion.div
                        key="calculate"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="grid"
                        ref={reportRef}
                    >
                        <div className="input-section">
                            <div className="card-title">
                                <Settings size={18} /> Deal Configuration
                            </div>

                            <div className="form-group">
                                <label>Company Name</label>
                                <input
                                    type="text"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="Enter company name"
                                    style={{ paddingLeft: '1rem' }}
                                />
                            </div>

                            <div className="form-group">
                                <label>Target Country(s)</label>
                                <input
                                    type="text"
                                    value={countries}
                                    onChange={(e) => setCountries(e.target.value)}
                                    placeholder="e.g. UK, Germany, France"
                                    style={{ paddingLeft: '1rem' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label>Initial Service Fee</label>
                                    <div className="input-wrapper">
                                        <span className="currency-symbol">{currencySymbols[currency]}</span>
                                        <input
                                            type="number"
                                            value={initialServiceFee}
                                            onChange={(e) => setInitialServiceFee(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Total Service Fee</label>
                                    <div className="input-wrapper">
                                        <span className="currency-symbol">{currencySymbols[currency]}</span>
                                        <input
                                            type="number"
                                            value={totalServiceFee}
                                            onChange={(e) => setTotalServiceFee(e.target.value)}
                                        />
                                    </div>
                                </div>
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
                            </div>
                        </div>

                        <div className="results-panel">
                            <div className="card-title">
                                <Info size={18} /> Financial Analysis
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

                            <div className="save-actions">
                                <button className="btn-secondary" onClick={() => addDeal('potential')}>
                                    <History size={18} /> Add to Potential
                                </button>
                                <button className="btn-primary" onClick={() => addDeal('signed')}>
                                    <Briefcase size={18} /> Add to Signed
                                </button>
                            </div>

                            <div className="actions">
                                <button className="btn-secondary" onClick={() => downloadPDF(reportRef, `Anatop_Deal_${companyName || 'Draft'}`)}>
                                    <FileDown size={18} /> Download Analysis
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {(activeTab === 'signed' || activeTab === 'potential') && (
                    <motion.div
                        key="pipeline"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="pipeline-section"
                    >
                        <div className="card-title">
                            {activeTab === 'signed' ? <Briefcase size={18} /> : <History size={18} />}
                            {activeTab === 'signed' ? 'Signed Deals List' : 'Potential Deals Pipeline'}
                        </div>

                        {deals.filter(d => d.type === activeTab).length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                                <p style={{ color: 'var(--text-dim)' }}>No deals found in this category.</p>
                            </div>
                        ) : (
                            <div className="deals-table-container">
                                <table className="deals-table">
                                    <thead>
                                        <tr>
                                            <th>Company/Country</th>
                                            <th>Fees (Initial/Total)</th>
                                            <th>Transfer Price</th>
                                            <th>Incl. COGS?</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {deals.filter(d => d.type === activeTab).map(deal => (
                                            <tr key={deal.id}>
                                                <td>
                                                    <div style={{ fontWeight: 700 }}>
                                                        {editingDealId === deal.id ? (
                                                            <input
                                                                type="text"
                                                                value={deal.companyName}
                                                                onChange={(e) => updateDeal(deal.id, 'companyName', e.target.value)}
                                                                style={{ padding: '4px', height: 'auto', fontSize: '0.9rem' }}
                                                            />
                                                        ) : deal.companyName}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                                                        {editingDealId === deal.id ? (
                                                            <input
                                                                type="text"
                                                                value={deal.countries}
                                                                onChange={(e) => updateDeal(deal.id, 'countries', e.target.value)}
                                                                style={{ padding: '4px', height: 'auto', fontSize: '0.75rem' }}
                                                            />
                                                        ) : deal.countries}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ fontSize: '0.9rem' }}>
                                                        {editingDealId === deal.id ? (
                                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                                <input
                                                                    type="number"
                                                                    value={deal.initialServiceFee}
                                                                    onChange={(e) => updateDeal(deal.id, 'initialServiceFee', parseFloat(e.target.value))}
                                                                    style={{ padding: '4px', height: 'auto', fontSize: '0.8rem', width: '60px' }}
                                                                />
                                                                <span>/</span>
                                                                <input
                                                                    type="number"
                                                                    value={deal.totalServiceFee}
                                                                    onChange={(e) => updateDeal(deal.id, 'totalServiceFee', parseFloat(e.target.value))}
                                                                    style={{ padding: '4px', height: 'auto', fontSize: '0.8rem', width: '60px' }}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {formatCurrency(deal.initialServiceFee, deal.currency)} /
                                                                {formatCurrency(deal.totalServiceFee, deal.currency)}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    {editingDealId === deal.id ? (
                                                        <input
                                                            type="number"
                                                            value={deal.transferPrice}
                                                            onChange={(e) => updateDeal(deal.id, 'transferPrice', parseFloat(e.target.value))}
                                                            style={{ padding: '4px', height: 'auto', fontSize: '0.9rem', width: '80px' }}
                                                        />
                                                    ) : formatCurrency(deal.transferPrice, deal.currency)}
                                                </td>
                                                <td>
                                                    {editingDealId === deal.id ? (
                                                        <select
                                                            value={deal.includesCogs ? 'yes' : 'no'}
                                                            onChange={(e) => updateDeal(deal.id, 'includesCogs', e.target.value === 'yes')}
                                                            style={{ padding: '4px', borderRadius: '4px', border: '1px solid var(--border)' }}
                                                        >
                                                            <option value="yes">Yes</option>
                                                            <option value="no">No</option>
                                                        </select>
                                                    ) : (
                                                        <span className={`payment-badge ${deal.includesCogs ? 'success' : ''}`}>
                                                            {deal.includesCogs ? 'Yes' : 'No'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="action-btns">
                                                        {editingDealId === deal.id ? (
                                                            <button className="icon-btn" onClick={() => setEditingDealId(null)} title="Save">
                                                                <Save size={16} color="var(--success)" />
                                                            </button>
                                                        ) : (
                                                            <button className="icon-btn" onClick={() => setEditingDealId(deal.id)} title="Edit">
                                                                <Edit size={16} />
                                                            </button>
                                                        )}
                                                        <button
                                                            className="icon-btn"
                                                            onClick={async () => {
                                                                // To download a full report for a saved deal, 
                                                                // we temporarily set the calculator state
                                                                setCompanyName(deal.companyName);
                                                                setCountries(deal.countries);
                                                                setInitialServiceFee(deal.initialServiceFee.toString());
                                                                setTotalServiceFee(deal.totalServiceFee.toString());
                                                                setTransferPriceInput(deal.transferPrice.toString());
                                                                setForecastSalesInput(deal.forecastSales.toString());
                                                                setSupplier(deal.supplier);
                                                                setMedinfarCogsInput(deal.medinfarCogs.toString());
                                                                setRoyaltyAfterCogs(deal.includesCogs);
                                                                setRoyalties(deal.royalties);
                                                                setCurrency(deal.currency);
                                                                setActiveTab('calculate');
                                                                // Wait for React to render the calculate tab
                                                                setTimeout(() => {
                                                                    downloadPDF(reportRef, `Anatop_Deal_${deal.companyName}`);
                                                                }, 100);
                                                            }}
                                                            title="Download PDF"
                                                        >
                                                            <FileDown size={16} />
                                                        </button>
                                                        <button className="icon-btn delete" onClick={() => deleteDeal(deal.id)} title="Delete">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default App;
