import { calculateProfit, DEFAULT_ROYALTIES } from './src/utils/calculator.js';

function test() {
    console.log('--- Verification Test 1: 11k units (Updated COGS) ---');
    const res1 = calculateProfit(5, 11000);
    console.log('COGS per unit:', res1.cogsPerUnit, '(Expected: 2.19)');

    console.log('\n--- Verification Test 2: Medinfar Manual COGS ---');
    const res2 = calculateProfit(5, 50000, false, 1.25);
    console.log('COGS per unit:', res2.cogsPerUnit, '(Expected: 1.25)');
    console.log('Total COGS:', res2.totalCogs, `(Expected: ${1.25 * 50000})`);

    console.log('\n--- Verification Test 3: Royalty POST-COGS logic ---');
    // TP = 5, COGS = 2, Result base = 3
    // KammPhillips (15%): 3 * 0.15 = 0.45
    const res3 = calculateProfit(5, 10000, true, 2);
    console.log('First Royalty Per Unit:', res3.royalties[0].perUnit, '(Expected: 0.45)');

    console.log('\n--- Verification Test 4: Custom Royalty Rates ---');
    const customRoyalties = [...DEFAULT_ROYALTIES];
    customRoyalties[0] = { ...customRoyalties[0], rate: 0.20 }; // KammPhillips 20%
    const res4 = calculateProfit(5, 10000, false, null, customRoyalties);
    console.log('KammPhillips (20%) Per Unit:', res4.royalties[0].perUnit, '(Expected: 1.00)');
}

test();
