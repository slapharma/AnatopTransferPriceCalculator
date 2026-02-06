export interface RoyaltyTier {
    name: string;
    rate: number;
}

export interface CalculationResult {
    transferPricePerUnit: number;
    totalRevenue: number;
    cogsPerUnit: number;
    totalCogs: number;
    royalties: Array<{ name: string; amount: number; rate: number }>;
    totalRoyalties: number;
    netProfit: number;
    profitPerUnit: number;
    profitMargin: number;
}

const ROYALTIES: RoyaltyTier[] = [
    { name: 'KammPhillips', rate: 0.15 },
    { name: 'Emin', rate: 0.075 },
    { name: 'Lubowski', rate: 0.15 },
    { name: 'Pharmula', rate: 0.10 },
    { name: 'Aspire', rate: 0.04 },
];

export function getCogsForBatchSize(batchSize: number): number {
    if (batchSize < 11000) return 1.79; // Assuming max price for small batches
    if (batchSize < 44000) return 1.79;
    if (batchSize < 66000) return 1.49;
    if (batchSize < 110000) return 1.42;
    return 1.37;
}

/**
 * Calculates transfer price breakdown
 * @param transferPrice Transfer price per unit in EUR
 * @param forecastSales Annual forecast sales (units)
 */
export function calculateProfit(
    transferPrice: number,
    forecastSales: number
): CalculationResult {
    const cogsPerUnit = getCogsForBatchSize(forecastSales);
    const totalCogs = cogsPerUnit * forecastSales;
    const totalRevenue = transferPrice * forecastSales;

    let remainingForRoyalties = transferPrice;
    const royaltiesBreakdown = [];
    let totalRoyaltiesPerUnit = 0;

    for (const royalty of ROYALTIES) {
        const royaltyAmount = remainingForRoyalties * royalty.rate;
        royaltiesBreakdown.push({
            name: royalty.name,
            amount: royaltyAmount * forecastSales,
            rate: royalty.rate,
        });
        totalRoyaltiesPerUnit += royaltyAmount;
        remainingForRoyalties -= royaltyAmount;
    }

    const totalRoyalties = totalRoyaltiesPerUnit * forecastSales;
    const netProfit = totalRevenue - totalCogs - totalRoyalties;
    const profitPerUnit = netProfit / forecastSales;
    const profitMargin = (netProfit / totalRevenue) * 100;

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
    };
}
