import { calculateProfit } from './src/utils/calculator.js';

function test() {
    console.log('--- Verification Test 1: 22k units, 5 EUR TP ---');
    const res1 = calculateProfit(5, 22000);
    console.log('COGS per unit:', res1.cogsPerUnit, '(Expected: 1.79)');
    console.log('Total Royalties:', res1.totalRoyalties);
    // KammPhillips: 5 * 0.15 = 0.75
    // Emin: (5 - 0.75) * 0.075 = 4.25 * 0.075 = 0.31875
    // Lubowski: (4.25 - 0.31875) * 0.15 = 3.93125 * 0.15 = 0.5896875
    // Pharmula: (3.93125 - 0.5896875) * 0.10 = 3.3415625 * 0.1 = 0.33415625
    // Aspire: (3.3415625 - 0.33415625) * 0.04 = 3.00740625 * 0.04 = 0.12029625
    // Total Royalty Per Unit: 0.75 + 0.31875 + 0.5896875 + 0.33415625 + 0.12029625 = 2.11289
    console.log('Royalty Per Unit:', res1.totalRoyalties / 22000, '(Expected: ~2.11289)');

    console.log('\n--- Verification Test 2: 110k units, 10 GBP TP (assume 1.2 GBP/EUR) ---');
    // 10 GBP = 12 EUR approx
    const res2 = calculateProfit(12, 110000);
    console.log('COGS per unit:', res2.cogsPerUnit, '(Expected: 1.37)');
    console.log('Profit Margin:', res2.profitMargin.toFixed(2) + '%');
}

test();
