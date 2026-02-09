export interface RoyaltyTier {
    name: string;
    rate: number;
}

export type PricingType = 'Reimbursed' | 'Patient' | 'Wholesale';

export interface ServiceFee {
    amount: number;
    year: 1 | 2 | 3;
}

export interface ServiceFees {
    signing: ServiceFee;
    approval: ServiceFee;
    launch: ServiceFee;
}

export interface CalculationResult {
    transferPricePerUnit: number;
    totalRevenue: number;
    cogsPerUnit: number;
    totalCogs: number;
    royalties: Array<{ name: string; amount: number; rate: number; perUnit: number }>;
    totalRoyalties: number;
    overhead: number;
    netProfit: number;
    serviceFeeIncome: number;
    profitPerUnit: number;
    profitMargin: number;
    royaltyBase: 'TP' | 'Profit'; // TP = Royalty on Transfer Price, Profit = Royalty on (TP - COGS)
}

export interface YearlyBreakdown extends CalculationResult {
    year: number;
    sales: number;
}

export interface FiveYearCalculationResult {
    years: YearlyBreakdown[];
    totalFiveYearRevenue: number;
    totalFiveYearCogs: number;
    totalFiveYearRoyalties: number;
    totalFiveYearNetProfit: number;
    averageMargin: number;
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
    customRoyalties: RoyaltyTier[] = DEFAULT_ROYALTIES,
    annualServiceFee: number = 0
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

    // SLA Overhead: 25% of the remaining profit per unit after production and final royalty
    // Logic: (Transfer Price - COGS - Royalties) * 0.25 (per unit logic scaled by sales)
    const netBeforeOverhead = totalRevenue - totalCogs - totalRoyalties;
    const overhead = netBeforeOverhead > 0 ? netBeforeOverhead * 0.25 : 0;

    const netProfit = netBeforeOverhead - overhead + annualServiceFee;
    const profitPerUnit = forecastSales > 0 ? netProfit / forecastSales : 0;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
        transferPricePerUnit: transferPrice,
        totalRevenue,
        cogsPerUnit,
        totalCogs,
        royalties: royaltiesBreakdown,
        totalRoyalties,
        overhead,
        netProfit,
        serviceFeeIncome: annualServiceFee,
        profitPerUnit,
        profitMargin: isFinite(profitMargin) ? profitMargin : 0,
        royaltyBase: royaltyAfterCogs ? 'Profit' : 'TP'
    };
}

export function calculateFiveYearProfit(
    transferPrice: number,
    fiveYearSales: number[],
    serviceFees: ServiceFees,
    royaltyAfterCogs: boolean = false,
    customCogs: number | null = null,
    customRoyalties: RoyaltyTier[] = DEFAULT_ROYALTIES
): FiveYearCalculationResult {
    const yearlyBreakdowns: YearlyBreakdown[] = fiveYearSales.map((sales, index) => {
        const yearNumber = index + 1;

        let annualFee = 0;
        if (serviceFees.signing.year === yearNumber) annualFee += serviceFees.signing.amount;
        if (serviceFees.approval.year === yearNumber) annualFee += serviceFees.approval.amount;
        if (serviceFees.launch.year === yearNumber) annualFee += serviceFees.launch.amount;

        const result = calculateProfit(transferPrice, sales, royaltyAfterCogs, customCogs, customRoyalties, annualFee);
        return {
            ...result,
            year: yearNumber,
            sales
        };
    });

    const totalFiveYearRevenue = yearlyBreakdowns.reduce((sum, y) => sum + y.totalRevenue, 0);
    const totalFiveYearCogs = yearlyBreakdowns.reduce((sum, y) => sum + y.totalCogs, 0);
    const totalFiveYearRoyalties = yearlyBreakdowns.reduce((sum, y) => sum + y.totalRoyalties, 0);
    const totalFiveYearNetProfit = yearlyBreakdowns.reduce((sum, y) => sum + y.netProfit, 0);
    const averageMargin = totalFiveYearRevenue > 0 ? (totalFiveYearNetProfit / totalFiveYearRevenue) * 100 : 0;

    return {
        years: yearlyBreakdowns,
        totalFiveYearRevenue,
        totalFiveYearCogs,
        totalFiveYearRoyalties,
        totalFiveYearNetProfit,
        averageMargin
    };
}
