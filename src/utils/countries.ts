export interface Country {
    name: string;
    code: string;
    population: number; // in millions
    region: string;
}

export const COUNTRIES: Country[] = [
    // --- EUROPE ---
    { name: 'Austria', code: 'AT', population: 9.0, region: 'Europe' },
    { name: 'Belgium', code: 'BE', population: 11.6, region: 'Europe' },
    { name: 'Bulgaria', code: 'BG', population: 6.9, region: 'Europe' },
    { name: 'Croatia', code: 'HR', population: 4.1, region: 'Europe' },
    { name: 'Cyprus', code: 'CY', population: 1.2, region: 'Europe' },
    { name: 'Czech Republic', code: 'CZ', population: 10.7, region: 'Europe' },
    { name: 'Denmark', code: 'DK', population: 5.8, region: 'Europe' },
    { name: 'Estonia', code: 'EE', population: 1.3, region: 'Europe' },
    { name: 'Finland', code: 'FI', population: 5.5, region: 'Europe' },
    { name: 'France', code: 'FR', population: 67.4, region: 'Europe' },
    { name: 'Germany', code: 'DE', population: 83.2, region: 'Europe' },
    { name: 'Greece', code: 'GR', population: 10.7, region: 'Europe' },
    { name: 'Hungary', code: 'HU', population: 9.7, region: 'Europe' },
    { name: 'Iceland', code: 'IS', population: 0.4, region: 'Europe' },
    { name: 'Ireland', code: 'IE', population: 5.0, region: 'Europe' },
    { name: 'Italy', code: 'IT', population: 59.3, region: 'Europe' },
    { name: 'Latvia', code: 'LV', population: 1.9, region: 'Europe' },
    { name: 'Lithuania', code: 'LT', population: 2.8, region: 'Europe' },
    { name: 'Luxembourg', code: 'LU', population: 0.6, region: 'Europe' },
    { name: 'Malta', code: 'MT', population: 0.5, region: 'Europe' },
    { name: 'Netherlands', code: 'NL', population: 17.4, region: 'Europe' },
    { name: 'Norway', code: 'NO', population: 5.4, region: 'Europe' },
    { name: 'Poland', code: 'PL', population: 38.0, region: 'Europe' },
    { name: 'Portugal', code: 'PT', population: 10.3, region: 'Europe' },
    { name: 'Romania', code: 'RO', population: 19.3, region: 'Europe' },
    { name: 'Slovakia', code: 'SK', population: 5.5, region: 'Europe' },
    { name: 'Slovenia', code: 'SI', population: 2.1, region: 'Europe' },
    { name: 'Spain', code: 'ES', population: 47.4, region: 'Europe' },
    { name: 'Sweden', code: 'SE', population: 10.4, region: 'Europe' },
    { name: 'Switzerland', code: 'CH', population: 8.6, region: 'Europe' },
    { name: 'United Kingdom', code: 'GB', population: 67.2, region: 'Europe' },

    // --- NORTH AMERICA ---
    { name: 'Canada', code: 'CA', population: 38.0, region: 'North America' },
    { name: 'Mexico', code: 'MX', population: 128.9, region: 'North America' },
    { name: 'United States', code: 'US', population: 331.0, region: 'North America' },

    // --- GCC & MENA ---
    { name: 'United Arab Emirates', code: 'AE', population: 9.9, region: 'GCC' },
    { name: 'Saudi Arabia', code: 'SA', population: 34.8, region: 'GCC' },
    { name: 'Qatar', code: 'QA', population: 2.9, region: 'GCC' },
    { name: 'Kuwait', code: 'KW', population: 4.3, region: 'GCC' },
    { name: 'Oman', code: 'OM', population: 5.1, region: 'GCC' },
    { name: 'Bahrain', code: 'BH', population: 1.7, region: 'GCC' },
    { name: 'Egypt', code: 'EG', population: 102.3, region: 'MENA' },
    { name: 'Jordan', code: 'JO', population: 10.2, region: 'MENA' },
    { name: 'Lebanon', code: 'LB', population: 6.8, region: 'MENA' },
    { name: 'Morocco', code: 'MA', population: 36.9, region: 'MENA' },
    { name: 'Tunisia', code: 'TN', population: 11.8, region: 'MENA' },
    { name: 'Algeria', code: 'DZ', population: 43.8, region: 'MENA' },
    { name: 'Iraq', code: 'IQ', population: 40.2, region: 'MENA' },
    { name: 'Israel', code: 'IL', population: 9.2, region: 'MENA' },
    { name: 'Iran', code: 'IR', population: 84.0, region: 'MENA' },

    // --- ASIA PACIFIC ---
    { name: 'Australia', code: 'AU', population: 25.7, region: 'Asia Pacific' },
    { name: 'China', code: 'CN', population: 1411.0, region: 'Asia Pacific' },
    { name: 'Hong Kong', code: 'HK', population: 7.5, region: 'Asia Pacific' },
    { name: 'India', code: 'IN', population: 1380.0, region: 'Asia Pacific' },
    { name: 'Indonesia', code: 'ID', population: 273.5, region: 'Asia Pacific' },
    { name: 'Japan', code: 'JP', population: 125.8, region: 'Asia Pacific' },
    { name: 'Malaysia', code: 'MY', population: 32.4, region: 'Asia Pacific' },
    { name: 'New Zealand', code: 'NZ', population: 5.1, region: 'Asia Pacific' },
    { name: 'Philippines', code: 'PH', population: 109.6, region: 'Asia Pacific' },
    { name: 'Singapore', code: 'SG', population: 5.7, region: 'Asia Pacific' },
    { name: 'South Korea', code: 'KR', population: 51.8, region: 'Asia Pacific' },
    { name: 'Taiwan', code: 'TW', population: 23.6, region: 'Asia Pacific' },
    { name: 'Thailand', code: 'TH', population: 69.8, region: 'Asia Pacific' },
    { name: 'Vietnam', code: 'VN', population: 97.3, region: 'Asia Pacific' },
    { name: 'Pakistan', code: 'PK', population: 220.9, region: 'Asia Pacific' },
    { name: 'Bangladesh', code: 'BD', population: 164.7, region: 'Asia Pacific' },

    // --- AFRICA ---
    { name: 'South Africa', code: 'ZA', population: 59.3, region: 'Africa' },
    { name: 'Nigeria', code: 'NG', population: 206.1, region: 'Africa' },
    { name: 'Kenya', code: 'KE', population: 53.8, region: 'Africa' },
    { name: 'Ethiopia', code: 'ET', population: 115.0, region: 'Africa' },
    { name: 'Ghana', code: 'GH', population: 31.1, region: 'Africa' },
    { name: 'Tanzania', code: 'TZ', population: 59.7, region: 'Africa' },
    { name: 'Uganda', code: 'UG', population: 45.7, region: 'Africa' },
    { name: 'Ivory Coast', code: 'CI', population: 26.4, region: 'Africa' },
    { name: 'Senegal', code: 'SN', population: 16.7, region: 'Africa' },

    // --- LATIN AMERICA ---
    { name: 'Argentina', code: 'AR', population: 45.4, region: 'Latin America' },
    { name: 'Brazil', code: 'BR', population: 212.6, region: 'Latin America' },
    { name: 'Chile', code: 'CL', population: 19.1, region: 'Latin America' },
    { name: 'Colombia', code: 'CO', population: 50.9, region: 'Latin America' },
    { name: 'Peru', code: 'PE', population: 33.0, region: 'Latin America' },
    { name: 'Venezuela', code: 'VE', population: 28.4, region: 'Latin America' }
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
