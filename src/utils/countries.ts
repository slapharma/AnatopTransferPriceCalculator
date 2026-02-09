export interface Country {
    name: string;
    code: string;
    population: number; // in millions
    region: string;
}

export const COUNTRIES: Country[] = [
    // Europe
    { name: 'United Kingdom', code: 'GB', population: 67.7, region: 'Europe' },
    { name: 'Germany', code: 'DE', population: 83.2, region: 'Europe' },
    { name: 'France', code: 'FR', population: 67.8, region: 'Europe' },
    { name: 'Italy', code: 'IT', population: 59.0, region: 'Europe' },
    { name: 'Spain', code: 'ES', population: 47.6, region: 'Europe' },
    { name: 'Poland', code: 'PL', population: 38.0, region: 'Europe' },
    { name: 'Netherlands', code: 'NL', population: 17.5, region: 'Europe' },
    { name: 'Belgium', code: 'BE', population: 11.6, region: 'Europe' },
    { name: 'Sweden', code: 'SE', population: 10.5, region: 'Europe' },
    { name: 'Austria', code: 'AT', population: 9.0, region: 'Europe' },
    { name: 'Switzerland', code: 'CH', population: 8.7, region: 'Europe' },
    { name: 'Denmark', code: 'DK', population: 5.9, region: 'Europe' },
    { name: 'Finland', code: 'FI', population: 5.5, region: 'Europe' },
    { name: 'Norway', code: 'NO', population: 5.5, region: 'Europe' },
    { name: 'Ireland', code: 'IE', population: 5.1, region: 'Europe' },
    { name: 'Portugal', code: 'PT', population: 10.3, region: 'Europe' },
    { name: 'Greece', code: 'GR', population: 10.4, region: 'Europe' },
    { name: 'Czech Republic', code: 'CZ', population: 10.5, region: 'Europe' },
    { name: 'Romania', code: 'RO', population: 19.1, region: 'Europe' },
    { name: 'Hungary', code: 'HU', population: 9.7, region: 'Europe' },

    // North America
    { name: 'United States', code: 'US', population: 331.9, region: 'North America' },
    { name: 'Canada', code: 'CA', population: 38.2, region: 'North America' },
    { name: 'Mexico', code: 'MX', population: 128.9, region: 'North America' },

    // Asia Pacific
    { name: 'Japan', code: 'JP', population: 125.7, region: 'Asia Pacific' },
    { name: 'South Korea', code: 'KR', population: 51.7, region: 'Asia Pacific' },
    { name: 'Australia', code: 'AU', population: 25.7, region: 'Asia Pacific' },
    { name: 'New Zealand', code: 'NZ', population: 5.1, region: 'Asia Pacific' },
    { name: 'Singapore', code: 'SG', population: 5.7, region: 'Asia Pacific' },
    { name: 'Taiwan', code: 'TW', population: 23.6, region: 'Asia Pacific' },
    { name: 'Hong Kong', code: 'HK', population: 7.5, region: 'Asia Pacific' },

    // Middle East
    { name: 'United Arab Emirates', code: 'AE', population: 9.9, region: 'Middle East' },
    { name: 'Saudi Arabia', code: 'SA', population: 35.3, region: 'Middle East' },
    { name: 'Israel', code: 'IL', population: 9.4, region: 'Middle East' },

    // Latin America
    { name: 'Brazil', code: 'BR', population: 214.3, region: 'Latin America' },
    { name: 'Argentina', code: 'AR', population: 45.8, region: 'Latin America' },
    { name: 'Chile', code: 'CL', population: 19.5, region: 'Latin America' },
    { name: 'Colombia', code: 'CO', population: 51.3, region: 'Latin America' },

    // Africa
    { name: 'South Africa', code: 'ZA', population: 60.0, region: 'Africa' },
];

export interface TerritoryForecast {
    country: Country;
    marketSize: number; // units
    addressable: number; // units
    anatopShare: number; // units
    peakRevenue: number; // EUR
}

export function calculateTerritoryForecast(
    country: Country,
    prevalence: number, // percentage (e.g., 0.35 for 0.35%)
    caf: number, // percentage (e.g., 40 for 40%)
    marketShare: number, // percentage (e.g., 50 for 50%)
    price: number // EUR per unit
): TerritoryForecast {
    const populationInUnits = country.population * 1_000_000;
    const marketSize = populationInUnits * (prevalence / 100);
    const addressable = marketSize * (caf / 100);
    const anatopShare = addressable * (marketShare / 100);
    const peakRevenue = anatopShare * price;

    return {
        country,
        marketSize,
        addressable,
        anatopShare,
        peakRevenue
    };
}
