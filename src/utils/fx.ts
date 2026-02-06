export type Currency = 'EUR' | 'GBP' | 'USD';

export interface FXRates {
    EUR: number;
    GBP: number;
    USD: number;
}

// Fallback rates if API fails (approximate as of early 2026)
const FALLBACK_RATES: FXRates = {
    EUR: 1,
    GBP: 0.83,
    USD: 1.08,
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
