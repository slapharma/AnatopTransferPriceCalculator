export type Currency = 'EUR' | 'GBP' | 'USD';

export interface FXRates {
    EUR: number;
    GBP: number;
    USD: number;
    lastUpdated: string;
}

// Fallback rates if API fails (approximate as of early 2026)
const FALLBACK_RATES: FXRates = {
    EUR: 1,
    GBP: 0.83,
    USD: 1.08,
    lastUpdated: 'Fallback'
};

export async function fetchFXRates(): Promise<FXRates> {
    try {
        const response = await fetch('https://open.er-api.com/v6/latest/EUR');
        if (!response.ok) throw new Error('FX Fetch failed');
        const data = await response.json();
        return {
            EUR: 1,
            GBP: data.rates.GBP || FALLBACK_RATES.GBP,
            USD: data.rates.USD || FALLBACK_RATES.USD,
            lastUpdated: data.time_last_update_utc ? new Date(data.time_last_update_utc).toLocaleDateString() : new Date().toLocaleDateString()
        };
    } catch (error) {
        console.error('Error fetching FX rates, using fallbacks:', error);
        return FALLBACK_RATES;
    }
}

export function convertPrice(amount: number, from: Currency, to: Currency, rates: FXRates): number {
    if (from === to) return amount;

    // Convert from source to EUR (base)
    const amountInEUR = amount / rates[from];

    // Convert from EUR to target
    return amountInEUR * rates[to];
}

export function formatRateDisplay(rates: FXRates): { eurToGbp: string; eurToUsd: string; gbpToUsd: string } {
    return {
        eurToGbp: `1 EUR = ${rates.GBP.toFixed(4)} GBP`,
        eurToUsd: `1 EUR = ${rates.USD.toFixed(4)} USD`,
        gbpToUsd: `1 GBP = ${(rates.USD / rates.GBP).toFixed(4)} USD`
    };
}
