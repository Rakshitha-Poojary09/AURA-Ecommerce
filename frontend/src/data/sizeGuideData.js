/**
 * AURA Atelier Size Guide Data & Configurations
 * 
 * Provides distinct, structured sizing specifications for:
 * 1. Men's Shirts & Tops
 * 2. Women's Shirts & Blouses
 * 3. Men's Pants & Trousers
 * 4. Women's Pants & Trousers
 * 5. Men's Kurtas
 * 6. Women's Kurtas & Tunics
 * 
 * NOTE: These measurements represent standard garment measurements in inches.
 * Marked as provisional standard sizing references pending final manufacturer specification.
 */

export const PROVISIONAL_NOTE = 
  "Provisional Standard Sizing Reference: Specifications shown are standard atelier garment dimensions in inches. Final tailored tolerances may vary by ±0.5 in. (±1.3 cm). Always refer to individual garment fit notes.";

export const MEASUREMENT_ADVICE = {
  garmentVsBody: 
    "These are garment measurements taken with the item laid completely flat, not body measurements. For the ideal silhouette, measure a similar well-fitting garment from your personal wardrobe and compare with the values below.",
  measuringTips: [
    "Lay the garment on a flat, firm surface and smooth out all folds.",
    "Use a flexible tailor's tape measure for optimal precision.",
    "If your measurements fall between sizes, we recommend selecting the larger size for a relaxed drape or the smaller size for a tailored fit."
  ]
};

export const SIZE_GUIDES = {
  men_shirt: {
    id: 'men_shirt',
    gender: 'men',
    garmentType: 'shirt',
    displayName: "Men's Shirts & Tops",
    categoryLabel: "Men • Shirts",
    silhouetteNote: "Tailored regular fit with clean drape across shoulders and relaxed chest ease.",
    columns: [
      { key: 'size', label: 'Size', isHeader: true },
      { key: 'chest', label: 'Chest (Pit-to-Pit x2)' },
      { key: 'shoulder', label: 'Shoulder' },
      { key: 'length', label: 'Body Length' },
      { key: 'sleeve', label: 'Sleeve Length' }
    ],
    rows: [
      { size: 'XS', chest: 36, shoulder: 16.5, length: 28, sleeve: 32 },
      { size: 'S', chest: 38, shoulder: 17.5, length: 29, sleeve: 33 },
      { size: 'M', chest: 40, shoulder: 18.5, length: 30, sleeve: 34 },
      { size: 'L', chest: 43, shoulder: 19.5, length: 31, sleeve: 35 },
      { size: 'XL', chest: 46, shoulder: 20.5, length: 31.5, sleeve: 36 },
      { size: 'XXL', chest: 49, shoulder: 21.5, length: 32, sleeve: 36.5 }
    ],
    points: [
      { key: 'chest', letter: 'A', name: 'Chest', instruction: 'Measure flat across garment from armpit to armpit, then double the number.' },
      { key: 'shoulder', letter: 'B', name: 'Shoulder', instruction: 'Measure straight across from shoulder seam to shoulder seam at the widest point.' },
      { key: 'length', letter: 'C', name: 'Body Length', instruction: 'Measure from highest point of shoulder beside collar straight down to the bottom hem.' },
      { key: 'sleeve', letter: 'D', name: 'Sleeve Length', instruction: 'Measure from the top shoulder seam down to the end of the cuff.' }
    ]
  },

  women_shirt: {
    id: 'women_shirt',
    gender: 'women',
    garmentType: 'shirt',
    displayName: "Women's Shirts & Blouses",
    categoryLabel: "Women • Shirts & Blouses",
    silhouetteNote: "Feminine contour tailored with gentle bust darting and natural shoulder drop.",
    columns: [
      { key: 'size', label: 'Size', isHeader: true },
      { key: 'bust', label: 'Bust / Chest' },
      { key: 'shoulder', label: 'Shoulder' },
      { key: 'length', label: 'Length' },
      { key: 'sleeve', label: 'Sleeve Length' }
    ],
    rows: [
      { size: 'XS', bust: 34, shoulder: 14.5, length: 24.5, sleeve: 23 },
      { size: 'S', bust: 36, shoulder: 15.0, length: 25.0, sleeve: 23.5 },
      { size: 'M', bust: 38, shoulder: 15.5, length: 25.5, sleeve: 24 },
      { size: 'L', bust: 41, shoulder: 16.25, length: 26.0, sleeve: 24.5 },
      { size: 'XL', bust: 44, shoulder: 17.0, length: 26.5, sleeve: 25 },
      { size: 'XXL', bust: 47, shoulder: 17.75, length: 27.0, sleeve: 25.5 }
    ],
    points: [
      { key: 'bust', letter: 'A', name: 'Bust / Chest', instruction: 'Measure straight across the fullest part of the bust (armpit to armpit) and double.' },
      { key: 'shoulder', letter: 'B', name: 'Shoulder', instruction: 'Measure across the back from one shoulder point seam to the opposite.' },
      { key: 'length', letter: 'C', name: 'Garment Length', instruction: 'Measure from the shoulder seam next to the neck down to the bottom hemline.' },
      { key: 'sleeve', letter: 'D', name: 'Sleeve Length', instruction: 'Measure from shoulder apex seam down to the sleeve edge.' }
    ]
  },

  men_pants: {
    id: 'men_pants',
    gender: 'men',
    garmentType: 'pants',
    displayName: "Men's Pants & Trousers",
    categoryLabel: "Men • Pants & Trousers",
    silhouetteNote: "Classic straight-leg cut with comfortable mid-rise waistband and tailored leg opening.",
    columns: [
      { key: 'size', label: 'Size', isHeader: true },
      { key: 'waist', label: 'Waist' },
      { key: 'hip', label: 'Hip' },
      { key: 'inseam', label: 'Inseam' },
      { key: 'outseam', label: 'Full Outseam' }
    ],
    rows: [
      { size: 'XS', waist: '28 – 29', hip: 36, inseam: 30, outseam: 40 },
      { size: 'S', waist: '30 – 31', hip: 38, inseam: 31, outseam: 41 },
      { size: 'M', waist: '32 – 33', hip: 40, inseam: 32, outseam: 42 },
      { size: 'L', waist: '34 – 35', hip: 42, inseam: 32, outseam: 42.5 },
      { size: 'XL', waist: '36 – 37', hip: 44, inseam: 32.5, outseam: 43 },
      { size: 'XXL', waist: '38 – 40', hip: 47, inseam: 33, outseam: 43.5 }
    ],
    points: [
      { key: 'waist', letter: 'A', name: 'Waist', instruction: 'Measure flat across the top waistband seam from edge to edge and double.' },
      { key: 'hip', letter: 'B', name: 'Hip', instruction: 'Measure flat across the widest point of the hip area (approx. 7–8 in. below waistband) and double.' },
      { key: 'inseam', letter: 'C', name: 'Inseam', instruction: 'Measure from the center crotch seam down along the inner leg to the bottom ankle hem.' },
      { key: 'outseam', letter: 'D', name: 'Outseam', instruction: 'Measure along the outer seam from the top of the waistband down to the bottom hem.' }
    ]
  },

  women_pants: {
    id: 'women_pants',
    gender: 'women',
    garmentType: 'pants',
    displayName: "Women's Pants & Trousers",
    categoryLabel: "Women • Pants & Trousers",
    silhouetteNote: "High-waisted elegant tailored silhouette with generous hip contour and fluid fall.",
    columns: [
      { key: 'size', label: 'Size', isHeader: true },
      { key: 'waist', label: 'Waist' },
      { key: 'hip', label: 'Hip' },
      { key: 'inseam', label: 'Inseam' },
      { key: 'outseam', label: 'Full Outseam' }
    ],
    rows: [
      { size: 'XS', waist: '25 – 26', hip: '35 – 36', inseam: 28.5, outseam: 38.5 },
      { size: 'S', waist: '27 – 28', hip: '37 – 38', inseam: 29.0, outseam: 39.0 },
      { size: 'M', waist: '29 – 30', hip: '39 – 40', inseam: 29.5, outseam: 40.0 },
      { size: 'L', waist: '31 – 33', hip: '41 – 43', inseam: 30.0, outseam: 40.5 },
      { size: 'XL', waist: '34 – 36', hip: '44 – 46', inseam: 30.0, outseam: 41.0 },
      { size: 'XXL', waist: '37 – 39', hip: '47 – 49', inseam: 30.5, outseam: 41.5 }
    ],
    points: [
      { key: 'waist', letter: 'A', name: 'Waist', instruction: 'Measure flat across the top edge of the waistband, buttoned, and double.' },
      { key: 'hip', letter: 'B', name: 'Hip', instruction: 'Measure flat across the widest curve of the hips (approx. 7–8 in. below waistband) and double.' },
      { key: 'inseam', letter: 'C', name: 'Inseam', instruction: 'Measure from the inner crotch intersection down to the bottom ankle hem.' },
      { key: 'outseam', letter: 'D', name: 'Outseam', instruction: 'Measure along the outside side-seam from the top of waistband to the hem.' }
    ]
  },

  men_kurta: {
    id: 'men_kurta',
    gender: 'men',
    garmentType: 'kurta',
    displayName: "Men's Kurtas",
    categoryLabel: "Men • Kurtas & Tunics",
    silhouetteNote: "Heritage straight-cut bandhgala/mandarin collar kurta with comfortable chest and side vents.",
    columns: [
      { key: 'size', label: 'Size', isHeader: true },
      { key: 'chest', label: 'Chest' },
      { key: 'shoulder', label: 'Shoulder' },
      { key: 'length', label: 'Kurta Length' },
      { key: 'sleeve', label: 'Sleeve Length' },
      { key: 'hip', label: 'Hip' }
    ],
    rows: [
      { size: 'XS', chest: 38, shoulder: 17.0, length: 40, sleeve: 24.5, hip: 40 },
      { size: 'S', chest: 40, shoulder: 17.5, length: 41, sleeve: 25.0, hip: 42 },
      { size: 'M', chest: 42, shoulder: 18.5, length: 42, sleeve: 25.5, hip: 44 },
      { size: 'L', chest: 45, shoulder: 19.5, length: 43, sleeve: 26.0, hip: 47 },
      { size: 'XL', chest: 48, shoulder: 20.5, length: 44, sleeve: 26.5, hip: 50 },
      { size: 'XXL', chest: 51, shoulder: 21.5, length: 44.5, sleeve: 27.0, hip: 53 }
    ],
    points: [
      { key: 'chest', letter: 'A', name: 'Chest', instruction: 'Measure flat across the chest from armhole seam to armhole seam, then double.' },
      { key: 'shoulder', letter: 'B', name: 'Shoulder', instruction: 'Measure across the back from shoulder seam to shoulder seam.' },
      { key: 'length', letter: 'C', name: 'Kurta Length', instruction: 'Measure from high point of shoulder beside collar down to the bottom hemline.' },
      { key: 'sleeve', letter: 'D', name: 'Sleeve Length', instruction: 'Measure from top shoulder seam down to the sleeve cuff opening.' },
      { key: 'hip', letter: 'E', name: 'Hip', instruction: 'Measure across the kurta at the top of the side slits / vents and double.' }
    ]
  },

  women_kurta: {
    id: 'women_kurta',
    gender: 'women',
    garmentType: 'kurta',
    displayName: "Women's Kurtas & Tunics",
    categoryLabel: "Women • Kurtas & Tunics",
    silhouetteNote: "Graceful A-line and straight silhouettes designed with elegant side slits and natural drape.",
    columns: [
      { key: 'size', label: 'Size', isHeader: true },
      { key: 'bust', label: 'Bust / Chest' },
      { key: 'shoulder', label: 'Shoulder' },
      { key: 'length', label: 'Kurta Length' },
      { key: 'sleeve', label: 'Sleeve Length' },
      { key: 'hip', label: 'Hip' }
    ],
    rows: [
      { size: 'XS', bust: 34, shoulder: 14.5, length: 42.0, sleeve: 19.0, hip: 38 },
      { size: 'S', bust: 36, shoulder: 15.0, length: 43.0, sleeve: 19.5, hip: 40 },
      { size: 'M', bust: 38, shoulder: 15.5, length: 44.0, sleeve: 20.0, hip: 42 },
      { size: 'L', bust: 41, shoulder: 16.25, length: 44.5, sleeve: 20.5, hip: 45 },
      { size: 'XL', bust: 44, shoulder: 17.0, length: 45.0, sleeve: 21.0, hip: 48 },
      { size: 'XXL', bust: 47, shoulder: 17.75, length: 45.5, sleeve: 21.5, hip: 51 }
    ],
    points: [
      { key: 'bust', letter: 'A', name: 'Bust / Chest', instruction: 'Measure flat across fullest bust point armpit-to-armpit, and double.' },
      { key: 'shoulder', letter: 'B', name: 'Shoulder', instruction: 'Measure across the back between the shoulder seam edges.' },
      { key: 'length', letter: 'C', name: 'Kurta Length', instruction: 'Measure from high shoulder collar seam straight down to bottom hem.' },
      { key: 'sleeve', letter: 'D', name: 'Sleeve Length', instruction: 'Measure from shoulder seam to 3/4th or full sleeve cuff edge.' },
      { key: 'hip', letter: 'E', name: 'Hip', instruction: 'Measure straight across at the top opening of side slit and double.' }
    ]
  }
};

/**
 * Intelligent helper to detect the appropriate size guide for a given product.
 * Inspects:
 * - product.category ('Men', 'Women', 'Kids', etc.)
 * - product.subCategory
 * - product.name
 * - product.description
 * 
 * Returns one of:
 * 'men_shirt' | 'women_shirt' | 'men_pants' | 'women_pants' | 'men_kurta' | 'women_kurta'
 * or null if ambiguous / general category.
 */
export function detectProductGuide(product) {
  if (!product) return null;

  const rawCat = (product.category || '').toLowerCase().trim();
  const rawSubCat = (product.subCategory || '').toLowerCase().trim();
  const name = (product.name || '').toLowerCase().trim();
  const desc = (product.description || '').toLowerCase().trim();
  const combined = `${name} ${rawSubCat} ${desc}`;

  // Determine Gender: 'men' | 'women' | null
  let gender = null;
  if (rawCat === 'men' || combined.includes('men') || combined.includes('gentleman')) {
    gender = 'men';
  } else if (rawCat === 'women' || combined.includes('women') || combined.includes('ladies') || combined.includes('dress') || combined.includes('skirt')) {
    gender = 'women';
  }

  // Determine Garment Type: 'kurta' | 'pants' | 'shirt'
  let garmentType = null;

  // 1. Check Kurta
  if (
    combined.includes('kurta') || 
    combined.includes('kurti') || 
    combined.includes('tunic') || 
    combined.includes('sherwani')
  ) {
    garmentType = 'kurta';
  }
  // 2. Check Pants / Trousers / Jeans
  else if (
    combined.includes('pant') ||
    combined.includes('trouser') ||
    combined.includes('jean') ||
    combined.includes('denim') ||
    combined.includes('bottom') ||
    combined.includes('chino') ||
    combined.includes('jogger') ||
    combined.includes('shorts')
  ) {
    garmentType = 'pants';
  }
  // 3. Check Shirt / Tops / Blouse
  else if (
    combined.includes('shirt') ||
    combined.includes('top') ||
    combined.includes('blouse') ||
    combined.includes('tee') ||
    combined.includes('polo') ||
    combined.includes('knit')
  ) {
    garmentType = 'shirt';
  }

  // If both gender and garment type are detected, return the key
  if (gender && garmentType) {
    const key = `${gender}_${garmentType}`;
    if (SIZE_GUIDES[key]) {
      return key;
    }
  }

  // Fallbacks: if only gender or garment detected
  if (gender === 'men') {
    return garmentType === 'pants' ? 'men_pants' : (garmentType === 'kurta' ? 'men_kurta' : 'men_shirt');
  }
  if (gender === 'women') {
    return garmentType === 'pants' ? 'women_pants' : (garmentType === 'kurta' ? 'women_kurta' : 'women_shirt');
  }

  return null; // Let user manually select from modal switcher
}

/**
 * Unit conversion helper:
 * Converts inches to centimetres.
 * Handles numbers or string ranges like "28 – 29".
 */
export function convertToCm(valInches) {
  if (valInches === null || valInches === undefined) return '';

  if (typeof valInches === 'number') {
    return Math.round(valInches * 2.54);
  }

  const str = String(valInches).trim();
  // Check for range like "28 – 29" or "28 - 29"
  const rangeMatch = str.match(/^([\d.]+)\s*[–-]\s*([\d.]+)$/);
  if (rangeMatch) {
    const low = Math.round(Number(rangeMatch[1]) * 2.54);
    const high = Math.round(Number(rangeMatch[2]) * 2.54);
    return `${low} – ${high}`;
  }

  const num = Number(str);
  if (!isNaN(num)) {
    return Math.round(num * 2.54);
  }

  return str;
}
