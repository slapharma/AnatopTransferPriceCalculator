import { useState, useEffect, useMemo, useRef } from 'react';
import { type Currency, type FXRates, fetchFXRates, convertPrice } from './utils/fx';
import { calculateFiveYearProfit, DEFAULT_ROYALTIES, type RoyaltyTier, type PricingType, type ServiceFees } from './utils/calculator';
import { FileDown, Settings, Info, Lock, Briefcase, History, Trash2, Edit, Save, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Deal {
    id: string;
    companyName: string;
    countries: string;
    serviceFees: ServiceFees;
    currency: Currency;
    comparisonCurrency: Currency;
    transferPrice: number;
    partnerSellingPrice: number;
    pricingType: PricingType;
    forecastSales: number[];
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
    const [comparisonCurrency, setComparisonCurrency] = useState<Currency>('GBP');
    const [transferPriceInput, setTransferPriceInput] = useState<string>('5.00');
    const [forecastSalesInputs, setForecastSalesInputs] = useState<string[]>(['50000', '60000', '70000', '80000', '100000']);

    // Password State
    const [password, setPassword] = useState('');
    const [isAuthorized, setIsAuthorized] = useState(false);

    // Navigation State
    const [activeTab, setActiveTab] = useState<'signed' | 'potential' | 'calculate'>('calculate');

    // Deals State
    const [deals, setDeals] = useState<Deal[]>([]);

    // Calculator Extra Fields
    const [companyName, setCompanyName] = useState('');
    const [countries, setCountries] = useState('');

    // Expanded Service Fees
    const [serviceFees, setServiceFees] = useState<ServiceFees>({
        signing: { amount: 0, year: 1 },
        approval: { amount: 0, year: 1 },
        launch: { amount: 0, year: 1 }
    });

    // Partner Pricing
    const [partnerSellingPrice, setPartnerSellingPrice] = useState<string>('0.00');
    const [pricingType, setPricingType] = useState<PricingType>('Reimbursed');

    // UI state
    const [viewMode, setViewMode] = useState<'summary' | 'breakdown'>('summary');
    const [selectedRoyaltyYear, setSelectedRoyaltyYear] = useState<number>(1);
    const [editModalDeal, setEditModalDeal] = useState<Deal | null>(null);

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
            try {
                const parsed = JSON.parse(savedDeals);
                // Migrate old deals if needed (simple forecastSales to array)
                const migrated = parsed.map((d: any) => ({
                    ...d,
                    forecastSales: Array.isArray(d.forecastSales) ? d.forecastSales : [d.forecastSales || 0, 0, 0, 0, 0],
                    comparisonCurrency: d.comparisonCurrency || 'EUR',
                    serviceFees: d.serviceFees || {
                        signing: { amount: d.initialServiceFee || 0, year: 1 },
                        approval: { amount: 0, year: 1 },
                        launch: { amount: d.totalServiceFee || 0, year: 1 }
                    },
                    partnerSellingPrice: d.partnerSellingPrice || 0,
                    pricingType: d.pricingType || 'Reimbursed'
                }));
                setDeals(migrated);
            } catch (e) {
                console.error("Failed to parse deals", e);
            }
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
            serviceFees: { ...serviceFees },
            currency: currency,
            comparisonCurrency: comparisonCurrency,
            transferPrice: parseFloat(transferPriceInput) || 0,
            partnerSellingPrice: parseFloat(partnerSellingPrice) || 0,
            pricingType: pricingType,
            forecastSales: forecastSalesInputs.map(s => parseFloat(s) || 0),
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
        setServiceFees({
            signing: { amount: 0, year: 1 },
            approval: { amount: 0, year: 1 },
            launch: { amount: 0, year: 1 }
        });
        setPartnerSellingPrice('0.00');
    };

    const deleteDeal = (id: string) => {
        if (window.confirm('Are you sure you want to delete this deal?')) {
            setDeals(deals.filter(d => d.id !== id));
        }
    };

    const handleServiceFeeChange = (key: keyof ServiceFees, subField: 'amount' | 'year', value: number) => {
        setServiceFees(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [subField]: value
            }
        }));
    };

    const transferPriceInEUR = useMemo(() => {
        if (!rates) return parseFloat(transferPriceInput) || 0;
        return convertPrice(parseFloat(transferPriceInput) || 0, currency, 'EUR', rates);
    }, [transferPriceInput, currency, rates]);

    const fiveYearSales = forecastSalesInputs.map(s => parseFloat(s) || 0);

    const medinfarCogsInEUR = useMemo(() => {
        if (!rates) return parseFloat(medinfarCogsInput) || 0;
        return convertPrice(parseFloat(medinfarCogsInput) || 0, currency, 'EUR', rates);
    }, [medinfarCogsInput, currency, rates]);

    const results = useMemo(() => {
        const customCogs = supplier === 'Medinfar' ? medinfarCogsInEUR : null;
        return calculateFiveYearProfit(transferPriceInEUR, fiveYearSales, serviceFees, royaltyAfterCogs, customCogs, royalties);
    }, [transferPriceInEUR, fiveYearSales, serviceFees, royaltyAfterCogs, supplier, medinfarCogsInEUR, royalties]);

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
                <div style={{ display: 'flex', gap: '2rem' }}>
                    <div className="currency-group">
                        <label className="input-label">Deal Currency (Default to EUR)</label>
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
                    <div className="currency-group">
                        <label className="input-label">Comparison Currency</label>
                        <div className="currency-toggle">
                            {(['GBP', 'EUR', 'USD'] as Currency[]).map((c) => (
                                <button
                                    key={c}
                                    className={`toggle-btn ${comparisonCurrency === c ? 'active' : ''}`}
                                    onClick={() => setComparisonCurrency(c)}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>
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
                        className="grid-v2"
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

                            <div className="form-group">
                                <label>Service Fees & Schedule</label>
                                <div className="fees-grid">
                                    <div className="input-label" style={{ fontSize: '0.65rem' }}>Fee Type & Amount</div>
                                    <div className="input-label" style={{ fontSize: '0.65rem', textAlign: 'center' }}>Payment Year</div>

                                    {(['signing', 'approval', 'launch'] as const).map(type => (
                                        <div key={type} className="fee-row">
                                            <div className="input-wrapper">
                                                <span className="currency-symbol">{currencySymbols[currency]}</span>
                                                <input
                                                    type="number"
                                                    value={serviceFees[type].amount || ''}
                                                    onChange={(e) => handleServiceFeeChange(type, 'amount', parseFloat(e.target.value) || 0)}
                                                    placeholder={`${type.charAt(0).toUpperCase() + type.slice(1)} Fee`}
                                                />
                                            </div>
                                            <select
                                                value={serviceFees[type].year}
                                                onChange={(e) => handleServiceFeeChange(type, 'year', parseInt(e.target.value) as 1 | 2 | 3)}
                                                style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                                            >
                                                <option value={1}>Year 1</option>
                                                <option value={2}>Year 2</option>
                                                <option value={3}>Year 3</option>
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Target Partner Pricing</label>
                                <div className="segmented-control">
                                    {(['Reimbursed', 'Patient Price', 'Wholesale Price'] as const).map(p => (
                                        <button
                                            key={p}
                                            className={pricingType === p.split(' ')[0] ? 'active' : ''}
                                            onClick={() => setPricingType(p.split(' ')[0] as PricingType)}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                                <div className="input-wrapper">
                                    <span className="currency-symbol">{currencySymbols[currency]}</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={partnerSellingPrice}
                                        onChange={(e) => setPartnerSellingPrice(e.target.value)}
                                        placeholder="Enter expected selling price"
                                    />
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
                                <label>Forecast Annual Sales (Units) - 5 Year Outlook</label>
                                <div className="sales-grid">
                                    {forecastSalesInputs.map((val, idx) => (
                                        <div key={idx} className="year-input">
                                            <label>Year {idx + 1}</label>
                                            <input
                                                type="number"
                                                value={val}
                                                onChange={(e) => {
                                                    const newInputs = [...forecastSalesInputs];
                                                    newInputs[idx] = e.target.value;
                                                    setForecastSalesInputs(newInputs);
                                                }}
                                            />
                                        </div>
                                    ))}
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
                            <div className="tab-header-mini">
                                <div className="card-title">
                                    <Info size={18} /> Financial Analysis
                                </div>
                                <div className="view-toggle">
                                    <button
                                        className={`mini-tab ${viewMode === 'summary' ? 'active' : ''}`}
                                        onClick={() => setViewMode('summary')}
                                    >
                                        5-Year Summary
                                    </button>
                                    <button
                                        className={`mini-tab ${viewMode === 'breakdown' ? 'active' : ''}`}
                                        onClick={() => setViewMode('breakdown')}
                                    >
                                        Annual Breakdown
                                    </button>
                                </div>
                            </div>

                            {viewMode === 'summary' ? (
                                <table className="results-table">
                                    <thead>
                                        <tr>
                                            <th>Metric (5-Year Total)</th>
                                            <th style={{ textAlign: 'right' }}>{currency} (Deal)</th>
                                            <th style={{ textAlign: 'right' }}>{comparisonCurrency} (Comp)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>Total units</td>
                                            <td colSpan={2} style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                                {fiveYearSales.reduce((a, b) => a + b, 0).toLocaleString()}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Total Revenue</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(results.totalFiveYearRevenue, currency)}</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(results.totalFiveYearRevenue, comparisonCurrency)}</td>
                                        </tr>
                                        <tr>
                                            <td>Total COGS</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(results.totalFiveYearCogs, currency)}</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(results.totalFiveYearCogs, comparisonCurrency)}</td>
                                        </tr>
                                        <tr>
                                            <td>Total Royalties</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(results.totalFiveYearRoyalties, currency)}</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(results.totalFiveYearRoyalties, comparisonCurrency)}</td>
                                        </tr>
                                        <tr className="overhead-row">
                                            <td>SLA Overhead Costs (25%)</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(results.years.reduce((s, y) => s + y.overhead, 0), currency)}</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(results.years.reduce((s, y) => s + y.overhead, 0), comparisonCurrency)}</td>
                                        </tr>
                                        <tr>
                                            <td>Service Fee Income</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(results.years.reduce((s, y) => s + y.serviceFeeIncome, 0), currency)}</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(results.years.reduce((s, y) => s + y.serviceFeeIncome, 0), comparisonCurrency)}</td>
                                        </tr>
                                        <tr className="profit-row">
                                            <td>Net Profit</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(results.totalFiveYearNetProfit, currency)}</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(results.totalFiveYearNetProfit, comparisonCurrency)}</td>
                                        </tr>
                                        <tr>
                                            <td>Average Margin</td>
                                            <td colSpan={2} style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>
                                                {results.averageMargin.toFixed(2)}%
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            ) : (
                                <div className="breakdown-container">
                                    <table className="results-table breakdown">
                                        <thead>
                                            <tr>
                                                <th>Year</th>
                                                <th>Units</th>
                                                <th>COGS (EUR)</th>
                                                <th>Royalty (EUR)</th>
                                                <th>Overhead (EUR)</th>
                                                <th style={{ textAlign: 'right' }}>Net Profit ({currency})</th>
                                                <th style={{ textAlign: 'right' }}>Net Profit ({comparisonCurrency})</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.years.map((year) => (
                                                <tr key={year.year}>
                                                    <td>Year {year.year}</td>
                                                    <td>{year.sales.toLocaleString()}</td>
                                                    <td>€{year.cogsPerUnit.toFixed(2)}</td>
                                                    <td>{formatCurrency(year.totalRoyalties, currency)}</td>
                                                    <td>{formatCurrency(year.overhead, currency)}</td>
                                                    <td style={{ textAlign: 'right' }}>{formatCurrency(year.netProfit, currency)}</td>
                                                    <td style={{ textAlign: 'right' }}>{formatCurrency(year.netProfit, comparisonCurrency)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="royalties-section">
                                <div className="tab-header-mini" style={{ marginBottom: '1rem' }}>
                                    <div className="card-title" style={{ fontSize: '0.9rem' }}>
                                        Royalty Breakdown {viewMode === 'summary' ? '(5-Year Total)' : `(Year ${selectedRoyaltyYear})`}
                                    </div>
                                    {viewMode === 'breakdown' && (
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            {[1, 2, 3, 4, 5].map(y => (
                                                <button
                                                    key={y}
                                                    className={`mini-tab ${selectedRoyaltyYear === y ? 'active' : ''}`}
                                                    onClick={() => setSelectedRoyaltyYear(y)}
                                                    style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                                                >
                                                    Y{y}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="royalties-grid">
                                    {results.years[0].royalties.map((_, i) => {
                                        const displayAmount = viewMode === 'summary'
                                            ? results.years.reduce((sum, yr) => sum + yr.royalties[i].amount, 0)
                                            : results.years[selectedRoyaltyYear - 1].royalties[i].amount;

                                        const royaltyName = results.years[0].royalties[i].name;

                                        return (
                                            <div key={royaltyName} className="royalty-item">
                                                <span className="royalty-name">{royaltyName}</span>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                    <span className="royalty-amount">{formatCurrency(displayAmount, currency)}</span>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                                        {formatCurrency(displayAmount, comparisonCurrency)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <button className="btn-primary" style={{ width: '100%', marginTop: 'auto' }} onClick={() => addDeal('signed')}>
                                <Plus size={18} /> Add to Signed Deals
                            </button>
                            <button className="btn-secondary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => addDeal('potential')}>
                                <Plus size={18} /> Add to Potential Deals
                            </button>
                        </div>

                        <div className="actions" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn-secondary" onClick={() => downloadPDF(reportRef, `Anatop_Deal_${companyName || 'Draft'}`)}>
                                <FileDown size={18} /> Download Analysis Report
                            </button>
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
                                            <th>Total Service Fees</th>
                                            <th>Transfer Price</th>
                                            <th>Incl. COGS?</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {deals.filter(d => d.type === activeTab).map(deal => {
                                            const totalFees = deal.serviceFees.signing.amount + deal.serviceFees.approval.amount + deal.serviceFees.launch.amount;
                                            return (
                                                <tr key={deal.id}>
                                                    <td>
                                                        <div style={{ fontWeight: 700 }}>{deal.companyName}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{deal.countries}</div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontSize: '0.9rem' }}>
                                                            {formatCurrency(totalFees, deal.currency)}
                                                        </div>
                                                    </td>
                                                    <td>{formatCurrency(deal.transferPrice, deal.currency)}</td>
                                                    <td>
                                                        <span className={`payment-badge ${deal.includesCogs ? 'success' : ''}`}>
                                                            {deal.includesCogs ? 'Yes' : 'No'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="action-btns">
                                                            <button className="icon-btn" onClick={() => setEditModalDeal(deal)} title="Edit Deal (Popup)">
                                                                <Edit size={16} />
                                                            </button>
                                                            <button
                                                                className="icon-btn"
                                                                onClick={async () => {
                                                                    setCompanyName(deal.companyName);
                                                                    setCountries(deal.countries);
                                                                    setServiceFees(deal.serviceFees);
                                                                    setTransferPriceInput(deal.transferPrice.toString());
                                                                    setPartnerSellingPrice(deal.partnerSellingPrice.toString());
                                                                    setPricingType(deal.pricingType);
                                                                    setForecastSalesInputs(deal.forecastSales.map(n => n.toString()));
                                                                    setSupplier(deal.supplier);
                                                                    setMedinfarCogsInput(deal.medinfarCogs.toString());
                                                                    setRoyaltyAfterCogs(deal.includesCogs);
                                                                    setRoyalties(deal.royalties);
                                                                    setCurrency(deal.currency);
                                                                    setComparisonCurrency(deal.comparisonCurrency);
                                                                    setActiveTab('calculate');
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
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {editModalDeal && (
                    <div className="modal-overlay" onClick={() => setEditModalDeal(null)}>
                        <motion.div
                            className="modal-content"
                            onClick={e => e.stopPropagation()}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                        >
                            <div className="modal-header">
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Edit size={24} color="var(--primary)" />
                                    Update Deal: {editModalDeal.companyName}
                                </h2>
                                <button className="icon-btn" onClick={() => setEditModalDeal(null)}>&times;</button>
                            </div>

                            <div className="grid-v2">
                                <div className="input-section">
                                    <div className="form-group">
                                        <label>Company Name</label>
                                        <input
                                            type="text"
                                            value={editModalDeal.companyName}
                                            onChange={e => setEditModalDeal({ ...editModalDeal, companyName: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Target Countries</label>
                                        <input
                                            type="text"
                                            value={editModalDeal.countries}
                                            onChange={e => setEditModalDeal({ ...editModalDeal, countries: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Transfer Price ({editModalDeal.currency})</label>
                                        <input
                                            type="number"
                                            value={editModalDeal.transferPrice}
                                            onChange={e => setEditModalDeal({ ...editModalDeal, transferPrice: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Forecast Sales (5 Years)</label>
                                        <div className="sales-grid">
                                            {editModalDeal.forecastSales.map((s, i) => (
                                                <div key={i} className="year-input">
                                                    <label>Y{i + 1}</label>
                                                    <input
                                                        type="number"
                                                        value={s}
                                                        onChange={e => {
                                                            const fresh = [...editModalDeal.forecastSales];
                                                            fresh[i] = parseFloat(e.target.value) || 0;
                                                            setEditModalDeal({ ...editModalDeal, forecastSales: fresh });
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="input-section">
                                    <div className="form-group">
                                        <label>Service Fees Schedule</label>
                                        {(['signing', 'approval', 'launch'] as const).map(f => (
                                            <div key={f} className="fees-grid" style={{ marginBottom: '0.5rem' }}>
                                                <input
                                                    type="number"
                                                    value={editModalDeal.serviceFees[f].amount}
                                                    onChange={e => {
                                                        const updated = { ...editModalDeal.serviceFees, [f]: { ...editModalDeal.serviceFees[f], amount: parseFloat(e.target.value) || 0 } };
                                                        setEditModalDeal({ ...editModalDeal, serviceFees: updated });
                                                    }}
                                                    placeholder={f}
                                                />
                                                <select
                                                    value={editModalDeal.serviceFees[f].year}
                                                    onChange={e => {
                                                        const updated = { ...editModalDeal.serviceFees, [f]: { ...editModalDeal.serviceFees[f], year: parseInt(e.target.value) } };
                                                        setEditModalDeal({ ...editModalDeal, serviceFees: updated });
                                                    }}
                                                >
                                                    <option value={1}>Year 1</option>
                                                    <option value={2}>Year 2</option>
                                                    <option value={3}>Year 3</option>
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="form-group">
                                        <label>Partner Pricing Type</label>
                                        <div className="segmented-control">
                                            {(['Reimbursed', 'Patient', 'Wholesale'] as const).map(p => (
                                                <button
                                                    key={p}
                                                    className={editModalDeal.pricingType === p ? 'active' : ''}
                                                    onClick={() => setEditModalDeal({ ...editModalDeal, pricingType: p as PricingType })}
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                        <input
                                            type="number"
                                            value={editModalDeal.partnerSellingPrice}
                                            onChange={e => setEditModalDeal({ ...editModalDeal, partnerSellingPrice: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="modal-actions" style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                                <button
                                    className="btn-primary"
                                    style={{ flex: 1 }}
                                    onClick={() => {
                                        setDeals(deals.map(d => d.id === editModalDeal.id ? editModalDeal : d));
                                        setEditModalDeal(null);
                                    }}
                                >
                                    <Save size={18} /> Update Deal Analysis
                                </button>
                                <button
                                    className="btn-secondary"
                                    style={{ flex: 1 }}
                                    onClick={() => setEditModalDeal(null)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
}

export default App;
