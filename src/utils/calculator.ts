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

export interface PartnerProfitAnalysis {
    partnerRevenue: number;
    partnerCost: number; // This is the Transfer Price they pay SLA
    partnerMargin: number;
    partnerMarginPercent: number;
}

export interface CalculationResult {
    transferPricePerUnit: number;
    totalRevenue: number;
    cogsPerUnit: number;
    totalCogs: number;
    royalties: Array<{ name: string; amount: number; rate: number; perUnit: number }>;
    totalRoyalties: number;
    overhead: number;
    overheadRate: number;
    netProfit: number;
    serviceFeeIncome: number;
    profitPerUnit: number;
    profitMargin: number;
    royaltyBase: 'TP' | 'Profit';
    partnerAnalysis: PartnerProfitAnalysis | null;
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
    totalFiveYearOverhead: number;
    totalFiveYearServiceFees: number;
    totalFiveYearNetProfit: number;
    averageMargin: number;
    totalPartnerProfit: number | null;
}

export interface ProfitShareResult {
    slaShare: number;
    partnerShare: number;
    slaSharePercent: number;
    partnerRevenue: number;
    partnerCogs: number;
    partnerProfit: number;
    slaProfit: number;
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
    if (batchSize < 22000) return 2.19;
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
 * @param annualServiceFee Service fees for this year
 * @param overheadRate Overhead percentage (default 0.25 = 25%)
 * @param partnerSellingPrice Partner's selling price for margin analysis
 */
export function calculateProfit(
    transferPrice: number,
    forecastSales: number,
    royaltyAfterCogs: boolean = false,
    customCogs: number | null = null,
    customRoyalties: RoyaltyTier[] = DEFAULT_ROYALTIES,
    annualServiceFee: number = 0,
    overheadRate: number = 0.25,
    partnerSellingPrice: number = 0
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

    // SLA Overhead: overhead rate of the remaining profit
    const netBeforeOverhead = totalRevenue - totalCogs - totalRoyalties;
    const overhead = netBeforeOverhead > 0 ? netBeforeOverhead * overheadRate : 0;

    const netProfit = netBeforeOverhead - overhead + annualServiceFee;
    const profitPerUnit = forecastSales > 0 ? netProfit / forecastSales : 0;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Partner profit analysis
    let partnerAnalysis: PartnerProfitAnalysis | null = null;
    if (partnerSellingPrice > 0 && forecastSales > 0) {
        const partnerRevenue = partnerSellingPrice * forecastSales;
        const partnerCost = totalRevenue; // They pay Transfer Price to SLA
        const partnerMargin = partnerRevenue - partnerCost;
        const partnerMarginPercent = partnerRevenue > 0 ? (partnerMargin / partnerRevenue) * 100 : 0;
        partnerAnalysis = {
            partnerRevenue,
            partnerCost,
            partnerMargin,
            partnerMarginPercent
        };
    }

    return {
        transferPricePerUnit: transferPrice,
        totalRevenue,
        cogsPerUnit,
        totalCogs,
        royalties: royaltiesBreakdown,
        totalRoyalties,
        overhead,
        overheadRate,
        netProfit,
        serviceFeeIncome: annualServiceFee,
        profitPerUnit,
        profitMargin: isFinite(profitMargin) ? profitMargin : 0,
        royaltyBase: royaltyAfterCogs ? 'Profit' : 'TP',
        partnerAnalysis
    };
}

export function calculateFiveYearProfit(
    transferPrice: number,
    fiveYearSales: number[],
    serviceFees: ServiceFees,
    royaltyAfterCogs: boolean = false,
    customCogs: number | null = null,
    customRoyalties: RoyaltyTier[] = DEFAULT_ROYALTIES,
    overheadRate: number = 0.25,
    partnerSellingPrice: number = 0
): FiveYearCalculationResult {
    const yearlyBreakdowns: YearlyBreakdown[] = fiveYearSales.map((sales, index) => {
        const yearNumber = index + 1;

        let annualFee = 0;
        if (serviceFees.signing.year === yearNumber) annualFee += serviceFees.signing.amount;
        if (serviceFees.approval.year === yearNumber) annualFee += serviceFees.approval.amount;
        if (serviceFees.launch.year === yearNumber) annualFee += serviceFees.launch.amount;

        const result = calculateProfit(transferPrice, sales, royaltyAfterCogs, customCogs, customRoyalties, annualFee, overheadRate, partnerSellingPrice);
        return {
            ...result,
            year: yearNumber,
            sales
        };
    });

    const totalFiveYearRevenue = yearlyBreakdowns.reduce((sum, y) => sum + y.totalRevenue, 0);
    const totalFiveYearCogs = yearlyBreakdowns.reduce((sum, y) => sum + y.totalCogs, 0);
    const totalFiveYearRoyalties = yearlyBreakdowns.reduce((sum, y) => sum + y.totalRoyalties, 0);
    const totalFiveYearOverhead = yearlyBreakdowns.reduce((sum, y) => sum + y.overhead, 0);
    const totalFiveYearServiceFees = yearlyBreakdowns.reduce((sum, y) => sum + y.serviceFeeIncome, 0);
    const totalFiveYearNetProfit = yearlyBreakdowns.reduce((sum, y) => sum + y.netProfit, 0);
    const averageMargin = totalFiveYearRevenue > 0 ? (totalFiveYearNetProfit / totalFiveYearRevenue) * 100 : 0;

    const totalPartnerProfit = partnerSellingPrice > 0
        ? yearlyBreakdowns.reduce((sum, y) => sum + (y.partnerAnalysis?.partnerMargin || 0), 0)
        : null;

    return {
        years: yearlyBreakdowns,
        totalFiveYearRevenue,
        totalFiveYearCogs,
        totalFiveYearRoyalties,
        totalFiveYearOverhead,
        totalFiveYearServiceFees,
        totalFiveYearNetProfit,
        averageMargin,
        totalPartnerProfit
    };
}

/**
 * Calculate a Profit Share deal based on partner's selling price
 * @param partnerSellingPrice Partner's retail/wholesale price per unit
 * @param fiveYearSales Array of yearly sales volumes
 * @param slaSharePercent SLA's share of the profit (e.g., 0.40 = 40%)
 * @param serviceFees Service fees from SLA
 * @param customCogs Optional custom COGS override
 * @param customRoyalties Royalty tiers
 * @param overheadRate SLA overhead rate
 */
export function calculateProfitShare(
    partnerSellingPrice: number,
    fiveYearSales: number[],
    slaSharePercent: number = 0.40,
    serviceFees: ServiceFees,
    customCogs: number | null = null,
    customRoyalties: RoyaltyTier[] = DEFAULT_ROYALTIES,
    overheadRate: number = 0.25
): FiveYearCalculationResult {
    // In profit share, the "transfer price" is effectively SLA's share of the partner's revenue
    // We need to calculate backwards from the partner selling price

    const yearlyBreakdowns: YearlyBreakdown[] = fiveYearSales.map((sales, index) => {
        const yearNumber = index + 1;
        const cogsPerUnit = customCogs !== null ? customCogs : getCogsForBatchSize(sales);

        // Partner's total revenue
        const partnerRevenue = partnerSellingPrice * sales;
        // Partner's COGS = SLA's COGS (they buy from SLA at cost + margin)
        const totalCogs = cogsPerUnit * sales;

        // Profit available to split after COGS
        const grossProfit = partnerRevenue - totalCogs;

        // SLA's share of the gross profit
        const slaGrossShare = grossProfit * slaSharePercent;

        // Calculate royalties on SLA's share
        let remainingForRoyalties = slaGrossShare / sales; // per unit
        const royaltiesBreakdown = [];
        let totalRoyaltiesPerUnit = 0;

        for (const royalty of customRoyalties) {
            const perUnitRoyalty = remainingForRoyalties * royalty.rate;
            royaltiesBreakdown.push({
                name: royalty.name,
                amount: perUnitRoyalty * sales,
                rate: royalty.rate,
                perUnit: perUnitRoyalty,
            });
            totalRoyaltiesPerUnit += perUnitRoyalty;
            remainingForRoyalties -= perUnitRoyalty;
        }

        const totalRoyalties = totalRoyaltiesPerUnit * sales;

        // Service fees for this year
        let annualFee = 0;
        if (serviceFees.signing.year === yearNumber) annualFee += serviceFees.signing.amount;
        if (serviceFees.approval.year === yearNumber) annualFee += serviceFees.approval.amount;
        if (serviceFees.launch.year === yearNumber) annualFee += serviceFees.launch.amount;

        // SLA overhead on their share after royalties
        const netBeforeOverhead = slaGrossShare - totalRoyalties;
        const overhead = netBeforeOverhead > 0 ? netBeforeOverhead * overheadRate : 0;

        const netProfit = netBeforeOverhead - overhead + annualFee;
        const transferPricePerUnit = sales > 0 ? slaGrossShare / sales : 0;
        const profitPerUnit = sales > 0 ? netProfit / sales : 0;
        const profitMargin = slaGrossShare > 0 ? (netProfit / slaGrossShare) * 100 : 0;

        // Partner analysis (they keep the rest)
        const partnerMargin = grossProfit * (1 - slaSharePercent);
        const partnerAnalysis: PartnerProfitAnalysis = {
            partnerRevenue,
            partnerCost: totalCogs + slaGrossShare, // COGS + SLA's share
            partnerMargin,
            partnerMarginPercent: partnerRevenue > 0 ? (partnerMargin / partnerRevenue) * 100 : 0
        };

        return {
            transferPricePerUnit,
            totalRevenue: slaGrossShare,
            cogsPerUnit,
            totalCogs,
            royalties: royaltiesBreakdown,
            totalRoyalties,
            overhead,
            overheadRate,
            netProfit,
            serviceFeeIncome: annualFee,
            profitPerUnit,
            profitMargin: isFinite(profitMargin) ? profitMargin : 0,
            royaltyBase: 'Profit' as const,
            partnerAnalysis,
            year: yearNumber,
            sales
        };
    });

    const totalFiveYearRevenue = yearlyBreakdowns.reduce((sum, y) => sum + y.totalRevenue, 0);
    const totalFiveYearCogs = yearlyBreakdowns.reduce((sum, y) => sum + y.totalCogs, 0);
    const totalFiveYearRoyalties = yearlyBreakdowns.reduce((sum, y) => sum + y.totalRoyalties, 0);
    const totalFiveYearOverhead = yearlyBreakdowns.reduce((sum, y) => sum + y.overhead, 0);
    const totalFiveYearServiceFees = yearlyBreakdowns.reduce((sum, y) => sum + y.serviceFeeIncome, 0);
    const totalFiveYearNetProfit = yearlyBreakdowns.reduce((sum, y) => sum + y.netProfit, 0);
    const averageMargin = totalFiveYearRevenue > 0 ? (totalFiveYearNetProfit / totalFiveYearRevenue) * 100 : 0;
    const totalPartnerProfit = yearlyBreakdowns.reduce((sum, y) => sum + (y.partnerAnalysis?.partnerMargin || 0), 0);

    return {
        years: yearlyBreakdowns,
        totalFiveYearRevenue,
        totalFiveYearCogs,
        totalFiveYearRoyalties,
        totalFiveYearOverhead,
        totalFiveYearServiceFees,
        totalFiveYearNetProfit,
        averageMargin,
        totalPartnerProfit
    };
}
