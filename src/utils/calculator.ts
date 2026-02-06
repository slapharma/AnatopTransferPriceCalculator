export interface RoyaltyTier {
    name: string;
    rate: number;
}

export interface CalculationResult {
    transferPricePerUnit: number;
    totalRevenue: number;
    cogsPerUnit: number;
    totalCogs: number;
    royalties: Array<{ name: string; amount: number; rate: number; perUnit: number }>;
    totalRoyalties: number;
    netProfit: number;
    profitPerUnit: number;
    profitMargin: number;
    royaltyBase: 'TP' | 'Profit'; // TP = Royalty on Transfer Price, Profit = Royalty on (TP - COGS)
}

export const DEFAULT_ROYALTIES: RoyaltyTier[] = [
    { name: 'KammPhillips', rate: 0.15 },
    { name: 'Emin', rate: 0.075 },
    { name: 'Lubowski', rate: 0.15 },
    { name: 'Pharmula', rate: 0.10 },
    { name: 'Aspire', rate: 0.04 },
];

export function getCogsForBatchSize(batchSize: number): number {
    if (batchSize < 11000) return 2.19;
    if (batchSize < 22000) return 2.19; // Updated from 1.79 to 2.19
    if (batchSize < 44000) return 1.79;
    if (batchSize < 66000) return 1.49;
    if (batchSize < 110000) return 1.42;
    return 1.37;
}

/**
 * Calculates transfer price breakdown
 * @param transferPrice Transfer price per unit in EUR
 * @param forecastSales Annual forecast sales (units)
 * @param royaltyAfterCogs If true, royalties are calculated on (TP - COGS)
 * @param customCogs If provided, overrides the batch-size based COGS
 * @param customRoyalties Map of royalty rates
 */
export function calculateProfit(
    transferPrice: number,
    forecastSales: number,
    royaltyAfterCogs: boolean = false,
    customCogs: number | null = null,
    customRoyalties: RoyaltyTier[] = DEFAULT_ROYALTIES
): CalculationResult {
    const cogsPerUnit = customCogs !== null ? customCogs : getCogsForBatchSize(forecastSales);
    const totalCogs = cogsPerUnit * forecastSales;
    const totalRevenue = transferPrice * forecastSales;

    // Deduction base: Either Transfer Price or (Transfer Price - COGS)
    const basePrice = royaltyAfterCogs ? Math.max(0, transferPrice - cogsPerUnit) : transferPrice;

    let remainingForRoyalties = basePrice;
    const royaltiesBreakdown = [];
    let totalRoyaltiesPerUnit = 0;

    for (const royalty of customRoyalties) {
        const perUnitRoyalty = remainingForRoyalties * royalty.rate;
        royaltiesBreakdown.push({
            name: royalty.name,
            amount: perUnitRoyalty * forecastSales,
            rate: royalty.rate,
            perUnit: perUnitRoyalty,
        });
        totalRoyaltiesPerUnit += perUnitRoyalty;
        remainingForRoyalties -= perUnitRoyalty;
    }

    const totalRoyalties = totalRoyaltiesPerUnit * forecastSales;
    const netProfit = totalRevenue - totalCogs - totalRoyalties;
    const profitPerUnit = forecastSales > 0 ? netProfit / forecastSales : 0;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
        transferPricePerUnit: transferPrice,
        totalRevenue,
        cogsPerUnit,
        totalCogs,
        royalties: royaltiesBreakdown,
        totalRoyalties,
        netProfit,
        profitPerUnit,
        profitMargin: isFinite(profitMargin) ? profitMargin : 0,
        royaltyBase: royaltyAfterCogs ? 'Profit' : 'TP'
    };
}
