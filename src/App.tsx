import { useState, useEffect, useMemo, useRef } from 'react';
import { type Currency, type FXRates, fetchFXRates, convertPrice, formatRateDisplay } from './utils/fx';
import { calculateFiveYearProfit, calculateProfitShare, DEFAULT_ROYALTIES, type RoyaltyTier, type PricingType, type ServiceFees, type FiveYearCalculationResult } from './utils/calculator';
import { COUNTRIES, calculateTerritoryForecast, type Country } from './utils/countries';
import { FileDown, Settings, Info, Lock, Briefcase, History, Trash2, Edit, Save, Plus, TrendingUp, RefreshCw, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type DealMode = 'transfer_price' | 'profit_share';

interface CountryBreakdown {
    id: string;
    country: Country;
    years: number[];
}

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
    royalties: RoyaltyTier[];
    type: 'signed' | 'potential';
    date: string;
    dealMode: DealMode;
    profitSharePercent: number;
    overheadRate: number;
    countryBreakdown?: CountryBreakdown[];
}

function App() {
    const [rates, setRates] = useState<FXRates | null>(null);
    const [currency, setCurrency] = useState<Currency>('EUR');
    const [comparisonCurrency, setComparisonCurrency] = useState<Currency>('GBP');
    const [transferPriceInput, setTransferPriceInput] = useState<string>('5.00');
    const [forecastSalesInputs, setForecastSalesInputs] = useState<string[]>(['0', '0', '0', '0', '0']);

    // Password State
    const [password, setPassword] = useState('');
    const [isAuthorized, setIsAuthorized] = useState(false);

    // Navigation State
    const [activeTab, setActiveTab] = useState<'signed' | 'potential' | 'calculate' | 'territory'>('calculate');

    // Deals State
    const [deals, setDeals] = useState<Deal[]>([]);

    // Calculator Extra Fields
    const [companyName, setCompanyName] = useState('');
    const [selectedDealCountries, setSelectedDealCountries] = useState<Country[]>([]);
    const [countryUnitsForecast, setCountryUnitsForecast] = useState<{ [key: string]: string[] }>({});
    const [savedForecasts, setSavedForecasts] = useState<{ id: string, name: string, entries: { id: string, country: Country }[] }[]>([]);

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
    const [royalties, setRoyalties] = useState<RoyaltyTier[]>(DEFAULT_ROYALTIES);

    // New Deal Mode State
    const [dealMode, setDealMode] = useState<DealMode>('transfer_price');
    const [profitSharePercent, setProfitSharePercent] = useState<string>('40');
    const [overheadRate, setOverheadRate] = useState<string>('25');
    const [showComparison, setShowComparison] = useState<boolean>(false);

    // Territory Forecast State
    const [territoryEntries, setTerritoryEntries] = useState<{ id: string, country: Country }[]>([]);
    const [countrySearch, setCountrySearch] = useState('');
    const [prevalence, setPrevalence] = useState<string>('0.35');
    const [caf, setCaf] = useState<string>('40');
    const [anatopMarketShare, setAnatopMarketShare] = useState<string>('50');
    const [anatopPrice, setAnatopPrice] = useState<string>('25');

    const reportRef = useRef<HTMLDivElement>(null);

    // Data Fetching & Migration
    useEffect(() => {
        fetchFXRates().then(setRates);

        const fetchData = async () => {
            try {
                // 1. Fetch Deals
                const dealsRes = await fetch('/api/deals');
                const serverDeals = await dealsRes.json();

                if (serverDeals.length > 0) {
                    setDeals(serverDeals);
                } else {
                    // Migration: Server empty, check localStorage
                    const localDeals = localStorage.getItem('anatop_deals');
                    if (localDeals) {
                        const parsed = JSON.parse(localDeals);
                        // Migrate old structure
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
                        // Push to server
                        await fetch('/api/deals', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(migrated)
                        });
                    }
                }

                // 2. Fetch Forecasts
                const forecastsRes = await fetch('/api/forecasts');
                const serverForecasts = await forecastsRes.json();

                if (serverForecasts.length > 0) {
                    setSavedForecasts(serverForecasts);
                } else {
                    // Migration
                    const localForecasts = localStorage.getItem('anatop_forecasts');
                    if (localForecasts) {
                        const parsed = JSON.parse(localForecasts);
                        setSavedForecasts(parsed);
                        await fetch('/api/forecasts', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(parsed)
                        });
                    }
                }

            } catch (err) {
                console.error("Failed to fetch data from API. Is the server running?", err);
                // Fallback to localStorage if server fails entirely
                const savedDeals = localStorage.getItem('anatop_deals');
                if (savedDeals) setDeals(JSON.parse(savedDeals));
                const savedF = localStorage.getItem('anatop_forecasts');
                if (savedF) setSavedForecasts(JSON.parse(savedF));
            }
        };

        fetchData();

        // Check Auth session
        const auth = sessionStorage.getItem('anatop_auth');
        if (auth === 'true') {
            setIsAuthorized(true);
        }
    }, []);

    // Save Deals to API
    useEffect(() => {
        if (deals.length === 0) return; // Avoid wiping server on initial empty render if logic delays
        // Simple debounce could be added here if high traffic, but sufficient for single tenant
        fetch('/api/deals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deals)
        }).catch(e => console.error("Failed to save deals", e));

        // Keep localStorage as backup/cache
        localStorage.setItem('anatop_deals', JSON.stringify(deals));
    }, [deals]);

    // Save Forecasts to API
    useEffect(() => {
        if (savedForecasts.length === 0) return;
        fetch('/api/forecasts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(savedForecasts)
        }).catch(e => console.error("Failed to save forecasts", e));

        localStorage.setItem('anatop_forecasts', JSON.stringify(savedForecasts));
    }, [savedForecasts]);

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
        const breakdown: CountryBreakdown[] = selectedDealCountries.map(c => ({
            id: Math.random().toString(36).substr(2, 9),
            country: c,
            years: (countryUnitsForecast[c.code] || ['0', '0', '0', '0', '0']).map(n => parseInt(n) || 0)
        }));

        const newDeal: Deal = {
            id: Date.now().toString(),
            companyName: companyName || 'Unnamed Company',
            countries: selectedDealCountries.map(c => c.name).join(', ') || 'N/A',
            serviceFees: { ...serviceFees },
            currency: currency,
            comparisonCurrency: comparisonCurrency,
            transferPrice: parseFloat(transferPriceInput) || 0,
            partnerSellingPrice: parseFloat(partnerSellingPrice) || 0,
            pricingType: pricingType,
            forecastSales: forecastSalesInputs.map(s => parseFloat(s) || 0),
            supplier: supplier,
            medinfarCogs: parseFloat(medinfarCogsInput) || 0,
            royalties: [...royalties],
            type: type,
            date: new Date().toLocaleDateString(),
            dealMode: dealMode,
            profitSharePercent: parseFloat(profitSharePercent) || 40,
            overheadRate: parseFloat(overheadRate) || 25,
            countryBreakdown: breakdown
        };
        setDeals([...deals, newDeal]);
        setActiveTab(type);
        // Clear fields
        setCompanyName('');
        setSelectedDealCountries([]);
        setCountryUnitsForecast({});
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

    const viewDeal = (deal: Deal) => {
        setCompanyName(deal.companyName);
        // Map names back to country objects if possible
        const names = deal.countries.split(', ');
        const mappedCountries = COUNTRIES.filter(c => names.includes(c.name));
        setSelectedDealCountries(mappedCountries);
        setServiceFees(deal.serviceFees);
        setTransferPriceInput(deal.transferPrice.toString());
        setPartnerSellingPrice(deal.partnerSellingPrice.toString());
        setPricingType(deal.pricingType);
        setForecastSalesInputs(deal.forecastSales.map(n => n.toString()));
        setSupplier(deal.supplier);
        setMedinfarCogsInput(deal.medinfarCogs.toString());
        setRoyalties(deal.royalties);
        setCurrency(deal.currency);
        setComparisonCurrency(deal.comparisonCurrency);
        setDealMode(deal.dealMode);
        setProfitSharePercent(deal.profitSharePercent.toString());
        setOverheadRate(deal.overheadRate.toString());

        const breakdownObj: { [key: string]: string[] } = {};
        if (deal.countryBreakdown) {
            deal.countryBreakdown.forEach(b => {
                breakdownObj[b.country.code] = b.years.map(y => y.toString());
            });
        }
        setCountryUnitsForecast(breakdownObj);

        setActiveTab('calculate');
    };

    const saveCurrentForecast = () => {
        if (territoryEntries.length === 0) return;
        const name = prompt('Enter a name for this forecast:', `Forecast ${new Date().toLocaleDateString()}`);
        if (!name) return;

        const newForecast = {
            id: Date.now().toString(),
            name,
            entries: [...territoryEntries]
        };
        setSavedForecasts([...savedForecasts, newForecast]);
    };

    const loadForecast = (forecast: any) => {
        setTerritoryEntries(forecast.entries);
    };

    const deleteForecast = (id: string) => {
        if (window.confirm('Delete this saved forecast?')) {
            setSavedForecasts(savedForecasts.filter(f => f.id !== id));
        }
    };

    const syncForecastFromTerritory = (forecast: { id: string, name: string, entries: { id: string, country: Country }[] }) => {
        const countries = forecast.entries.map(e => e.country);
        setSelectedDealCountries(countries);

        const newBreakdown: { [key: string]: string[] } = {};

        forecast.entries.forEach(entry => {
            const result = calculateTerritoryForecast(
                entry.country,
                parseFloat(prevalence) || 0.35,
                parseFloat(caf) || 40,
                parseFloat(anatopMarketShare) || 50,
                parseFloat(anatopPrice) || 25
            );

            const peak = Math.round(result.anatopShare);
            const ramp = [
                Math.round(peak * 0.1).toString(),
                Math.round(peak * 0.3).toString(),
                Math.round(peak * 0.6).toString(),
                peak.toString(),
                peak.toString()
            ];
            newBreakdown[entry.country.code] = ramp;
        });

        setCountryUnitsForecast(newBreakdown);

        // Calculate total
        const total = [0, 0, 0, 0, 0];
        Object.values(newBreakdown).forEach(years => {
            years.forEach((y, i) => total[i] += parseInt(y) || 0);
        });
        setForecastSalesInputs(total.map(t => t.toString()));
    };

    const handleCountryForecastChange = (code: string, yearIdx: number, val: string) => {
        const updated = { ...countryUnitsForecast };
        if (!updated[code]) return;
        updated[code][yearIdx] = val;
        setCountryUnitsForecast(updated);

        // Update total
        const total = [0, 0, 0, 0, 0];
        Object.values(updated).forEach(years => {
            years.forEach((y, i) => total[i] += parseInt(y) || 0);
        });
        setForecastSalesInputs(total.map(t => t.toString()));
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

    const partnerPriceInEUR = useMemo(() => {
        if (!rates) return parseFloat(partnerSellingPrice) || 0;
        return convertPrice(parseFloat(partnerSellingPrice) || 0, currency, 'EUR', rates);
    }, [partnerSellingPrice, currency, rates]);

    const fiveYearSales = forecastSalesInputs.map(s => parseFloat(s) || 0);

    const medinfarCogsInEUR = useMemo(() => {
        if (!rates) return parseFloat(medinfarCogsInput) || 0;
        return convertPrice(parseFloat(medinfarCogsInput) || 0, currency, 'EUR', rates);
    }, [medinfarCogsInput, currency, rates]);

    const overheadRateDecimal = (parseFloat(overheadRate) || 25) / 100;
    const profitShareDecimal = (parseFloat(profitSharePercent) || 40) / 100;

    const results = useMemo(() => {
        const customCogs = supplier === 'Medinfar' ? medinfarCogsInEUR : null;
        if (dealMode === 'profit_share') {
            return calculateProfitShare(partnerPriceInEUR, fiveYearSales, profitShareDecimal, serviceFees, customCogs, royalties, overheadRateDecimal);
        }
        return calculateFiveYearProfit(transferPriceInEUR, fiveYearSales, serviceFees, customCogs, royalties, overheadRateDecimal, partnerPriceInEUR);
    }, [transferPriceInEUR, partnerPriceInEUR, fiveYearSales, serviceFees, supplier, medinfarCogsInEUR, royalties, dealMode, overheadRateDecimal, profitShareDecimal]);

    // Comparison Results (always calculate the opposite mode for comparison)
    const comparisonResults = useMemo((): FiveYearCalculationResult | null => {
        if (!showComparison) return null;
        const customCogs = supplier === 'Medinfar' ? medinfarCogsInEUR : null;
        if (dealMode === 'profit_share') {
            // Compare with transfer price deal
            return calculateFiveYearProfit(transferPriceInEUR, fiveYearSales, serviceFees, customCogs, royalties, overheadRateDecimal, partnerPriceInEUR);
        }
        // Compare with profit share
        return calculateProfitShare(partnerPriceInEUR, fiveYearSales, profitShareDecimal, serviceFees, customCogs, royalties, overheadRateDecimal);
    }, [showComparison, transferPriceInEUR, partnerPriceInEUR, fiveYearSales, serviceFees, supplier, medinfarCogsInEUR, royalties, dealMode, overheadRateDecimal, profitShareDecimal]);

    const territoryForecasts = useMemo(() => {
        return territoryEntries.map(entry => ({
            ...calculateTerritoryForecast(
                entry.country,
                parseFloat(prevalence) || 0.35,
                parseFloat(caf) || 40,
                parseFloat(anatopMarketShare) || 50,
                parseFloat(anatopPrice) || 25
            ),
            id: entry.id
        }));
    }, [territoryEntries, prevalence, caf, anatopMarketShare, anatopPrice]);

    const sortedCountries = useMemo(() => {
        return [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));
    }, []);

    const filteredCountries = useMemo(() => {
        if (!countrySearch) return sortedCountries;
        const s = countrySearch.toLowerCase();
        return sortedCountries.filter(c => c.name.toLowerCase().includes(s) || c.region.toLowerCase().includes(s));
    }, [countrySearch, sortedCountries]);

    const totalTerritoryRevenue = useMemo(() => {
        return territoryForecasts.reduce((sum, f) => sum + f.peakRevenue, 0);
    }, [territoryForecasts]);

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
                <button
                    className={`tab-btn ${activeTab === 'territory' ? 'active' : ''}`}
                    onClick={() => setActiveTab('territory')}
                >
                    <Globe size={18} /> Territory Forecast
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

                            {/* FX Reference Box */}
                            <div className="fx-reference-box">
                                <div className="fx-header">
                                    <RefreshCw size={14} /> Today's Exchange Rates
                                    <span className="fx-date">{rates.lastUpdated}</span>
                                </div>
                                <div className="fx-rates">
                                    <span>{formatRateDisplay(rates).eurToGbp}</span>
                                    <span>{formatRateDisplay(rates).eurToUsd}</span>
                                </div>
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
                                <div className="country-multi-select" style={{ position: 'relative' }}>
                                    <div className="selected-countries-display" style={{
                                        padding: '0.75rem',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        minHeight: '42px',
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '0.5rem',
                                        background: 'white',
                                        cursor: 'pointer'
                                    }}>
                                        {selectedDealCountries.length > 0 ? selectedDealCountries.map(c => (
                                            <span key={c.code} style={{
                                                background: 'var(--primary)',
                                                color: 'white',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                {c.name}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedDealCountries(selectedDealCountries.filter(x => x.code !== c.code));
                                                    }}
                                                    style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, fontSize: '10px' }}
                                                >
                                                    &times;
                                                </button>
                                            </span>
                                        )) : <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Select countries...</span>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                                        <select
                                            onChange={(e) => {
                                                const code = e.target.value;
                                                const country = COUNTRIES.find(c => c.code === code);
                                                if (country && !selectedDealCountries.find(c => c.code === code)) {
                                                    const newSelected = [...selectedDealCountries, country];
                                                    setSelectedDealCountries(newSelected);
                                                    if (!countryUnitsForecast[code]) {
                                                        setCountryUnitsForecast({ ...countryUnitsForecast, [code]: ['0', '0', '0', '0', '0'] });
                                                    }
                                                }
                                                e.target.value = '';
                                            }}
                                            style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                                        >
                                            <option value="">Select Country</option>
                                            {sortedCountries.map(c => (
                                                <option key={c.code} value={c.code}>{c.name}</option>
                                            ))}
                                        </select>

                                        <div style={{ position: 'relative' }}>
                                            <button
                                                className="btn-secondary"
                                                onClick={() => {
                                                    const menu = document.getElementById('forecast-sync-menu');
                                                    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
                                                }}
                                                style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', height: '100%', whiteSpace: 'nowrap' }}
                                            >
                                                <Globe size={14} /> Sync Forecast
                                            </button>
                                            <div id="forecast-sync-menu" style={{
                                                display: 'none',
                                                position: 'absolute',
                                                top: '100%',
                                                right: 0,
                                                background: 'white',
                                                border: '1px solid var(--border)',
                                                borderRadius: '8px',
                                                marginTop: '4px',
                                                zIndex: 10,
                                                minWidth: '200px',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                            }}>
                                                <div style={{ padding: '0.5rem', borderBottom: '1px solid #f0f0f0', fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600 }}>CHOOSE SAVED FORECAST</div>
                                                {savedForecasts.length > 0 ? savedForecasts.map(f => (
                                                    <div
                                                        key={f.id}
                                                        onClick={() => {
                                                            syncForecastFromTerritory(f);
                                                            const menu = document.getElementById('forecast-sync-menu');
                                                            if (menu) menu.style.display = 'none';
                                                        }}
                                                        style={{ padding: '0.6rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f9f9f9', fontSize: '0.8rem' }}
                                                        onMouseOver={(e) => (e.currentTarget.style.background = '#f5f5f5')}
                                                        onMouseOut={(e) => (e.currentTarget.style.background = 'white')}
                                                    >
                                                        {f.name}
                                                    </div>
                                                )) : <div style={{ padding: '1rem', color: 'var(--text-dim)', fontSize: '0.8rem' }}>No saved forecasts found</div>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Deal Mode Toggle */}
                            <div className="form-group">
                                <label>Deal Structure</label>
                                <div className="segmented-control deal-mode-toggle">
                                    <button
                                        className={dealMode === 'transfer_price' ? 'active' : ''}
                                        onClick={() => setDealMode('transfer_price')}
                                    >
                                        <TrendingUp size={14} /> Transfer Price
                                    </button>
                                    <button
                                        className={dealMode === 'profit_share' ? 'active' : ''}
                                        onClick={() => setDealMode('profit_share')}
                                    >
                                        <RefreshCw size={14} /> Profit Share
                                    </button>
                                </div>
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
                                <div className="pricing-box" style={{
                                    display: 'flex',
                                    alignItems: 'stretch',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    background: 'white'
                                }}>
                                    <div className="segmented-control" style={{
                                        border: 'none',
                                        borderRadius: 0,
                                        margin: 0,
                                        padding: '4px',
                                        background: '#f9fafb',
                                        borderRight: '1px solid var(--border)',
                                        display: 'flex',
                                        gap: '2px'
                                    }}>
                                        {(['Reimbursed', 'Patient Price', 'Wholesale Price'] as const).map(p => (
                                            <button
                                                key={p}
                                                className={pricingType === p.split(' ')[0] ? 'active' : ''}
                                                style={{
                                                    fontSize: '0.65rem',
                                                    padding: '4px 10px',
                                                    whiteSpace: 'nowrap'
                                                }}
                                                onClick={() => setPricingType(p.split(' ')[0] as PricingType)}
                                            >
                                                {p.split(' ')[0]}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="input-wrapper" style={{ border: 'none', margin: 0, flex: 1 }}>
                                        <span className="currency-symbol" style={{ left: '0.75rem' }}>{currencySymbols[currency]}</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={partnerSellingPrice}
                                            onChange={(e) => setPartnerSellingPrice(e.target.value)}
                                            placeholder="0.00"
                                            style={{ border: 'none', borderRadius: 0, paddingLeft: '1.75rem' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Conditional: Transfer Price or Profit Share % */}
                            {dealMode === 'transfer_price' ? (
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
                            ) : (
                                <div className="form-group">
                                    <label>SLA Profit Share %</label>
                                    <div className="input-wrapper">
                                        <span className="currency-symbol">%</span>
                                        <input
                                            type="number"
                                            step="1"
                                            min="0"
                                            max="100"
                                            value={profitSharePercent}
                                            onChange={(e) => setProfitSharePercent(e.target.value)}
                                            placeholder="40"
                                        />
                                    </div>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                                        SLA receives {profitSharePercent}% of partner's gross profit
                                    </p>
                                </div>
                            )}

                            <div className="form-group">
                                <label>Forecast Annual Sales (Units) - 5 Year Outlook</label>
                                <div className="forecast-breakdown-table" style={{ background: '#f9fafb', borderRadius: '12px', padding: '1rem', border: '1px solid var(--border)' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Territory</th>
                                                <th>Y1</th>
                                                <th>Y2</th>
                                                <th>Y3</th>
                                                <th>Y4</th>
                                                <th>Y5</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedDealCountries.map(c => (
                                                <tr key={c.code} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                    <td style={{ padding: '0.5rem', fontWeight: 600 }}>{c.name}</td>
                                                    {[0, 1, 2, 3, 4].map(idx => (
                                                        <td key={idx} style={{ padding: '0.2rem' }}>
                                                            <input
                                                                type="number"
                                                                value={countryUnitsForecast[c.code]?.[idx] || '0'}
                                                                onChange={(e) => handleCountryForecastChange(c.code, idx, e.target.value)}
                                                                style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '0.8rem', padding: '0.2rem' }}
                                                            />
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                            <tr style={{ background: 'white', fontWeight: 700 }}>
                                                <td style={{ padding: '0.5rem' }}>TOTAL</td>
                                                {forecastSalesInputs.map((val, idx) => (
                                                    <td key={idx} style={{ padding: '0.2rem' }}>
                                                        <input
                                                            type="number"
                                                            value={val}
                                                            onChange={(e) => {
                                                                const newInputs = [...forecastSalesInputs];
                                                                newInputs[idx] = e.target.value;
                                                                setForecastSalesInputs(newInputs);
                                                            }}
                                                            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontWeight: 700, fontSize: '0.8rem' }}
                                                        />
                                                    </td>
                                                ))}
                                            </tr>
                                        </tbody>
                                    </table>
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



                            {/* SLA Overhead Rate - Editable */}
                            <div className="form-group">
                                <label>SLA Overhead Costs (%)</label>
                                <div className="input-wrapper">
                                    <span className="currency-symbol">%</span>
                                    <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        max="100"
                                        value={overheadRate}
                                        onChange={(e) => setOverheadRate(e.target.value)}
                                    />
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
                                <>
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
                                                <td>Total Inventory Royalties</td>
                                                <td style={{ textAlign: 'right' }}>{formatCurrency(results.totalFiveYearRoyalties, currency)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatCurrency(results.totalFiveYearRoyalties, comparisonCurrency)}</td>
                                            </tr>
                                            <tr className="overhead-row">
                                                <td>SLA Overhead Costs ({overheadRate}%)</td>
                                                <td style={{ textAlign: 'right' }}>{formatCurrency(results.totalFiveYearOverhead, currency)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatCurrency(results.totalFiveYearOverhead, comparisonCurrency)}</td>
                                            </tr>
                                            <tr>
                                                <td>Service Fee Income</td>
                                                <td style={{ textAlign: 'right' }}>{formatCurrency(results.totalFiveYearServiceFees, currency)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatCurrency(results.totalFiveYearServiceFees, comparisonCurrency)}</td>
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
                                            {/* Partner Profit Analysis */}
                                            {results.totalPartnerProfit !== null && (
                                                <>
                                                    <tr style={{ borderTop: '2px solid var(--border)' }}>
                                                        <td colSpan={3} style={{ fontWeight: 'bold', paddingTop: '1rem', color: 'var(--text-dim)' }}>
                                                            Partner Profit Analysis
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td>Partner Expected Revenue</td>
                                                        <td style={{ textAlign: 'right' }}>{formatCurrency(results.years.reduce((s, y) => s + (y.partnerAnalysis?.partnerRevenue || 0), 0), currency)}</td>
                                                        <td style={{ textAlign: 'right' }}>{formatCurrency(results.years.reduce((s, y) => s + (y.partnerAnalysis?.partnerRevenue || 0), 0), comparisonCurrency)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td>SLA Royalty</td>
                                                        <td style={{ textAlign: 'right' }}>{formatCurrency(results.years.reduce((s, y) => s + (y.partnerAnalysis?.partnerCost || 0), 0), currency)}</td>
                                                        <td style={{ textAlign: 'right' }}>{formatCurrency(results.years.reduce((s, y) => s + (y.partnerAnalysis?.partnerCost || 0), 0), comparisonCurrency)}</td>
                                                    </tr>
                                                    <tr className="profit-row" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                                                        <td>Partner Gross Margin</td>
                                                        <td style={{ textAlign: 'right' }}>{formatCurrency(results.totalPartnerProfit, currency)}</td>
                                                        <td style={{ textAlign: 'right' }}>{formatCurrency(results.totalPartnerProfit, comparisonCurrency)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td>Partner Margin %</td>
                                                        <td colSpan={2} style={{ textAlign: 'right', fontWeight: 'bold', color: '#10b981' }}>
                                                            {(results.years[0].partnerAnalysis?.partnerMarginPercent || 0).toFixed(2)}%
                                                        </td>
                                                    </tr>
                                                </>
                                            )}
                                        </tbody>
                                    </table>

                                    {/* Comparison Mode Toggle */}
                                    <div className="comparison-toggle" style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                            <input
                                                type="checkbox"
                                                checked={showComparison}
                                                onChange={(e) => setShowComparison(e.target.checked)}
                                                style={{ accentColor: 'var(--primary)' }}
                                            />
                                            Show {dealMode === 'transfer_price' ? 'Profit Share' : 'Transfer Price'} comparison
                                        </label>
                                    </div>

                                    {/* Comparison Results */}
                                    {showComparison && comparisonResults && (
                                        <div className="comparison-box" style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', border: '1px dashed var(--primary)' }}>
                                            <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--primary)' }}>
                                                {dealMode === 'transfer_price' ? 'Profit Share' : 'Transfer Price'} Alternative
                                            </h4>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.8rem' }}>
                                                <span>SLA Net Profit:</span>
                                                <span style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(comparisonResults.totalFiveYearNetProfit, currency)}</span>
                                                <span>Partner Profit:</span>
                                                <span style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(comparisonResults.totalPartnerProfit || 0, currency)}</span>
                                                <span>Margin:</span>
                                                <span style={{ textAlign: 'right', fontWeight: 'bold' }}>{comparisonResults.averageMargin.toFixed(2)}%</span>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="breakdown-container">
                                    <table className="results-table breakdown">
                                        <thead>
                                            <tr>
                                                <th>Year</th>
                                                <th>Units</th>
                                                <th>Gross Sales (EUR)</th>
                                                <th>Net Sales TP (EUR)</th>
                                                <th>Net Sales Royalty (EUR)</th>
                                                <th>Inventory Royalty (EUR)</th>
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
                                                    <td>€{(year.partnerAnalysis?.partnerRevenue || 0).toLocaleString()}</td>
                                                    <td>{dealMode === 'transfer_price' ? formatCurrency(year.totalRevenue, currency) : '-'}</td>
                                                    <td>{dealMode === 'profit_share' ? formatCurrency(year.totalRevenue, currency) : '-'}</td>
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
                    </motion.div >
                )
                }

                {
                    (activeTab === 'signed' || activeTab === 'potential') && (
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
                                                <th>Company Name</th>
                                                <th>Countries</th>
                                                <th>Y1 Forecast</th>
                                                <th>Peak Units</th>
                                                <th>Total Service Fees</th>
                                                <th>Deal Structure</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {deals.filter(d => d.type === activeTab).map(deal => {
                                                const totalFees = deal.serviceFees.signing.amount + deal.serviceFees.approval.amount + deal.serviceFees.launch.amount;
                                                const peakUnits = Math.max(...deal.forecastSales);
                                                return (
                                                    <tr key={deal.id}>
                                                        <td style={{ fontWeight: 700 }}>{deal.companyName}</td>
                                                        <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{deal.countries}</td>
                                                        <td>{deal.forecastSales[0].toLocaleString()}</td>
                                                        <td style={{ fontWeight: 600 }}>{peakUnits.toLocaleString()}</td>
                                                        <td>{formatCurrency(totalFees, deal.currency)}</td>
                                                        <td>
                                                            <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                                                                {deal.dealMode === 'transfer_price' ? 'Transfer Price' : 'Profit Share'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="action-btns">
                                                                <button className="icon-btn" onClick={() => viewDeal(deal)} title="View in Calculator" style={{ color: 'var(--primary)' }}>
                                                                    <TrendingUp size={16} />
                                                                </button>
                                                                <button
                                                                    className="icon-btn"
                                                                    onClick={async () => {
                                                                        viewDeal(deal);
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
                    )
                }

                {activeTab === 'territory' && (
                    <motion.div
                        key="territory"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="territory-forecast-section"
                    >
                        <div className="card-title">
                            <Globe size={18} /> SLA Territory Forecast
                        </div>

                        <div className="forecast-controls" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem', padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                            <div className="form-group">
                                <label>Market Size (Prevalence %)</label>
                                <div className="input-wrapper">
                                    <span className="currency-symbol">%</span>
                                    <input type="number" step="0.01" value={prevalence} onChange={(e) => setPrevalence(e.target.value)} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Addressable (CAF %)</label>
                                <div className="input-wrapper">
                                    <span className="currency-symbol">%</span>
                                    <input type="number" step="1" value={caf} onChange={(e) => setCaf(e.target.value)} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Anatop Market Share (%)</label>
                                <div className="input-wrapper">
                                    <span className="currency-symbol">%</span>
                                    <input type="number" step="1" value={anatopMarketShare} onChange={(e) => setAnatopMarketShare(e.target.value)} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Anatop Price (EUR)</label>
                                <div className="input-wrapper">
                                    <span className="currency-symbol">€</span>
                                    <input type="number" step="1" value={anatopPrice} onChange={(e) => setAnatopPrice(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        <div className="country-selector" style={{ marginBottom: '2rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        placeholder="Search countries (e.g. Saudi Arabia, UAE, China)..."
                                        value={countrySearch}
                                        onChange={(e) => setCountrySearch(e.target.value)}
                                        style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', width: '100%', fontSize: '1rem' }}
                                    />
                                    {countrySearch && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border)', borderRadius: '8px', marginTop: '4px', maxHeight: '250px', overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                            {filteredCountries.length > 0 ? filteredCountries.map(c => (
                                                <div
                                                    key={c.code}
                                                    className="search-result-item"
                                                    onClick={() => {
                                                        setTerritoryEntries([...territoryEntries, { id: Math.random().toString(36).substr(2, 9), country: c }]);
                                                        setCountrySearch('');
                                                    }}
                                                    style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}
                                                >
                                                    <span>{c.name}</span>
                                                    <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{c.region}</span>
                                                </div>
                                            )) : <div style={{ padding: '1rem', color: 'var(--text-dim)' }}>No countries found</div>}
                                        </div>
                                    )}
                                </div>
                                <button className="btn-primary" onClick={saveCurrentForecast} style={{ padding: '0.75rem 1.5rem', background: 'var(--success)' }}>
                                    <Save size={18} /> Save Forecast
                                </button>
                                <button className="btn-secondary" onClick={() => setTerritoryEntries([])} style={{ height: '100%' }}>
                                    <RefreshCw size={18} /> Clear
                                </button>
                            </div>

                            {savedForecasts.length > 0 && (
                                <div className="saved-forecasts" style={{ marginBottom: '1.5rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px' }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saved Analysis</div>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        {savedForecasts.map(f => (
                                            <div key={f.id} className="mini-tab" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1px solid var(--border)' }}>
                                                <span onClick={() => loadForecast(f)} style={{ cursor: 'pointer' }}>{f.name}</span>
                                                <button onClick={() => deleteForecast(f.id)} style={{ padding: 0, color: 'var(--danger)' }}>&times;</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="deals-table-container">
                            <table className="deals-table">
                                <thead>
                                    <tr>
                                        <th>Country Name</th>
                                        <th>Population (M)</th>
                                        <th>Market Size</th>
                                        <th>Addressable (CAF)</th>
                                        <th>Anatop Share</th>
                                        <th>Anatop Price</th>
                                        <th style={{ textAlign: 'right' }}>Peak Unit Sales</th>
                                        <th style={{ textAlign: 'right' }}>Peak Total Revenue</th>
                                        <th style={{ width: '40px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {territoryForecasts.map((f) => (
                                        <tr key={f.id}>
                                            <td>{f.country.name}</td>
                                            <td>{f.country.population}M</td>
                                            <td>{Math.round(f.marketSize).toLocaleString()}</td>
                                            <td>{Math.round(f.addressable).toLocaleString()}</td>
                                            <td>{Math.round(f.anatopShare).toLocaleString()}</td>
                                            <td>€{parseFloat(anatopPrice).toFixed(2)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Math.round(f.anatopShare).toLocaleString()}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>
                                                {formatCurrency(f.peakRevenue, 'EUR')}
                                            </td>
                                            <td>
                                                <button
                                                    onClick={() => setTerritoryEntries(territoryEntries.filter(e => e.id !== f.id))}
                                                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {territoryForecasts.length > 0 && (
                                        <tr style={{ background: 'var(--bg-secondary)', fontWeight: 'bold' }}>
                                            <td colSpan={7} style={{ textAlign: 'right', padding: '1rem' }}>Total Combined Peak Revenue:</td>
                                            <td style={{ textAlign: 'right', padding: '1rem', color: 'var(--primary)', fontSize: '1.1rem' }}>
                                                {formatCurrency(totalTerritoryRevenue, 'EUR')}
                                            </td>
                                        </tr>
                                    )}
                                    {territoryForecasts.length === 0 && (
                                        <tr>
                                            <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
                                                Please select countries above to see the territory forecast.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence >

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
                                        <div className="country-multi-select" style={{ position: 'relative' }}>
                                            <div className="selected-countries-display" style={{
                                                padding: '0.5rem',
                                                border: '1px solid var(--border)',
                                                borderRadius: '8px',
                                                minHeight: '36px',
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: '0.4rem',
                                                background: 'white',
                                                fontSize: '0.8rem'
                                            }}>
                                                {editModalDeal.countries ? editModalDeal.countries.split(', ').map(c => (
                                                    <span key={c} style={{
                                                        background: 'var(--primary)',
                                                        color: 'white',
                                                        padding: '1px 6px',
                                                        borderRadius: '4px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        {c}
                                                        <button
                                                            onClick={() => {
                                                                const filtered = editModalDeal.countries.split(', ').filter(x => x !== c).join(', ');
                                                                setEditModalDeal({ ...editModalDeal, countries: filtered });
                                                            }}
                                                            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, fontSize: '10px' }}
                                                        >
                                                            &times;
                                                        </button>
                                                    </span>
                                                )) : <span style={{ color: 'var(--text-dim)' }}>Select countries...</span>}
                                            </div>
                                            <select
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val && !editModalDeal.countries.includes(val)) {
                                                        const fresh = editModalDeal.countries ? `${editModalDeal.countries}, ${val}` : val;
                                                        setEditModalDeal({ ...editModalDeal, countries: fresh });
                                                    }
                                                }}
                                                style={{ marginTop: '0.4rem', width: '100%', padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                                            >
                                                <option value="">+ Add Country</option>
                                                {sortedCountries.map(c => (
                                                    <option key={c.code} value={c.name}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
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
