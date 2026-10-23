// Automated unit & integration verification for AURA Size Guide
import { SIZE_GUIDES, detectProductGuide, convertToCm, PROVISIONAL_NOTE, MEASUREMENT_ADVICE } from '../src/data/sizeGuideData.js';

console.log('====================================================');
console.log('🧪 RUNNING AURA SIZE GUIDE COMPREHENSIVE TEST SUITE');
console.log('====================================================\n');

let failed = 0;
let passed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${message}`);
    failed++;
  }
}

// 1. Verify all 6 size guide variants exist
const expectedGuides = [
  'men_shirt',
  'women_shirt',
  'men_pants',
  'women_pants',
  'men_kurta',
  'women_kurta'
];

console.log('--- 1. VERIFYING 6 DISTINCT SIZE GUIDES ---');
expectedGuides.forEach((key) => {
  const guide = SIZE_GUIDES[key];
  assert(Boolean(guide), `Size guide '${key}' exists in configuration`);
  assert(Array.isArray(guide.columns) && guide.columns.length >= 4, `'${key}' has structured measurement columns`);
  assert(Array.isArray(guide.rows) && guide.rows.length === 6, `'${key}' contains all 6 standard sizes (XS through XXL)`);
  assert(Array.isArray(guide.points) && guide.points.length >= 4, `'${key}' has measurement arrow callout points (A, B, C, D...)`);
  assert(typeof guide.silhouetteNote === 'string' && guide.silhouetteNote.length > 10, `'${key}' has silhouette fit advice note`);
});

// 2. Verify specific garment measurement attributes
console.log('\n--- 2. VERIFYING GARMENT-SPECIFIC MEASUREMENT ATTRIBUTES ---');
// Shirt must have Chest, Shoulder, Length, Sleeve
assert(
  SIZE_GUIDES.men_shirt.columns.some((c) => c.key === 'chest') &&
  SIZE_GUIDES.men_shirt.columns.some((c) => c.key === 'shoulder') &&
  SIZE_GUIDES.men_shirt.columns.some((c) => c.key === 'length') &&
  SIZE_GUIDES.men_shirt.columns.some((c) => c.key === 'sleeve'),
  "Men's shirt includes Chest, Shoulder, Length, and Sleeve measurements"
);

// Pants must have Waist, Hip, Inseam, Outseam
assert(
  SIZE_GUIDES.men_pants.columns.some((c) => c.key === 'waist') &&
  SIZE_GUIDES.men_pants.columns.some((c) => c.key === 'hip') &&
  SIZE_GUIDES.men_pants.columns.some((c) => c.key === 'inseam') &&
  SIZE_GUIDES.men_pants.columns.some((c) => c.key === 'outseam'),
  "Men's pants includes Waist, Hip, Inseam, and Outseam measurements"
);

assert(
  SIZE_GUIDES.women_pants.columns.some((c) => c.key === 'waist') &&
  SIZE_GUIDES.women_pants.columns.some((c) => c.key === 'hip') &&
  SIZE_GUIDES.women_pants.columns.some((c) => c.key === 'inseam') &&
  SIZE_GUIDES.women_pants.columns.some((c) => c.key === 'outseam'),
  "Women's pants includes Waist, Hip, Inseam, and Outseam measurements"
);

// Kurta must have Chest, Shoulder, Kurta Length, Sleeve, and Hip
assert(
  SIZE_GUIDES.men_kurta.columns.some((c) => c.key === 'chest') &&
  SIZE_GUIDES.men_kurta.columns.some((c) => c.key === 'shoulder') &&
  SIZE_GUIDES.men_kurta.columns.some((c) => c.key === 'length') &&
  SIZE_GUIDES.men_kurta.columns.some((c) => c.key === 'sleeve') &&
  SIZE_GUIDES.men_kurta.columns.some((c) => c.key === 'hip'),
  "Men's kurta includes Chest, Shoulder, Kurta Length, Sleeve, and Hip at side slits"
);

// 3. Verify Unit Conversion Logic (Inches -> Centimetres)
console.log('\n--- 3. VERIFYING INCHES TO CENTIMETRES CONVERSION ---');
assert(convertToCm(38) === 97, 'Single integer conversion: 38 in -> 97 cm (38 * 2.54 = 96.52 -> 97)');
assert(convertToCm(16.5) === 42, 'Decimal conversion: 16.5 in -> 42 cm (16.5 * 2.54 = 41.91 -> 42)');
assert(convertToCm('28 – 29') === '71 – 74', 'Range conversion: "28 – 29" in -> "71 – 74" cm');
assert(convertToCm('35 – 36') === '89 – 91', 'Range conversion: "35 – 36" in -> "89 – 91" cm');

// 4. Verify Intelligent Product Category & Gender Detection
console.log('\n--- 4. VERIFYING PRODUCT CATEGORY & GENDER DETECTION ---');
const testCases = [
  {
    product: { name: 'AURA Classic Linen Shirt', category: 'Women' },
    expected: 'women_shirt',
    description: "Women's Shirt maps to women_shirt"
  },
  {
    product: { name: 'Essential Blue Shirt', category: 'Men' },
    expected: 'men_shirt',
    description: "Men's Shirt maps to men_shirt"
  },
  {
    product: { name: 'Wide Leg Linen Pants', category: 'Women' },
    expected: 'women_pants',
    description: "Women's Pants maps to women_pants"
  },
  {
    product: { name: 'Washed Denim Jeans', category: 'Men' },
    expected: 'men_pants',
    description: "Men's Jeans/Pants maps to men_pants"
  },
  {
    product: { name: 'Wide-Leg Trousers', category: 'Men' },
    expected: 'men_pants',
    description: "Men's Trousers maps to men_pants"
  },
  {
    product: { name: 'Festive Silk Kurta', category: 'Men' },
    expected: 'men_kurta',
    description: "Men's Kurta maps to men_kurta"
  },
  {
    product: { name: 'Embroidered Cotton Kurti Tunic', category: 'Women' },
    expected: 'women_kurta',
    description: "Women's Kurti/Tunic maps to women_kurta"
  },
  {
    product: { name: 'Striped Casual Shirt', category: 'Women' },
    expected: 'women_shirt',
    description: "Women's Casual Shirt maps to women_shirt"
  }
];

testCases.forEach((tc) => {
  const detected = detectProductGuide(tc.product);
  assert(detected === tc.expected, `${tc.description} (Got: ${detected})`);
});

// 5. Verify Provisional Notice & Measurement Advice
console.log('\n--- 5. VERIFYING PROVISIONAL SIZING DISCLAIMER & ADVICE ---');
assert(
  PROVISIONAL_NOTE.includes('Provisional Standard Sizing Reference'),
  'Notice explicitly states "Provisional Standard Sizing Reference"'
);
assert(
  MEASUREMENT_ADVICE.garmentVsBody.includes('garment measurements taken with the item laid completely flat'),
  'Measurement advice explains flat garment vs body measurements'
);

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL SIZE GUIDE SPECIFICATION TESTS COMPLETED SUCCESSFULLY!');
  process.exit(0);
}
