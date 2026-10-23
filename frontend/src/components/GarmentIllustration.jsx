import React from 'react';

/**
 * High-precision vector garment measurement illustrations.
 * Renders tailored silhouettes for Shirts, Pants, and Kurtas
 * with clear measurement lines, arrows, and badge indicators matching the reference.
 */
export default function GarmentIllustration({ garmentType = 'shirt', gender = 'men' }) {
  if (garmentType === 'pants') {
    return <PantsIllustration gender={gender} />;
  }

  if (garmentType === 'kurta') {
    return <KurtaIllustration gender={gender} />;
  }

  // Default to Shirt
  return <ShirtIllustration gender={gender} />;
}

/* =========================================================================
   1. SHIRT MEASUREMENT ILLUSTRATION (Chest, Shoulder, Length, Sleeve)
   ========================================================================= */
function ShirtIllustration({ gender = 'men' }) {
  const isWomen = gender === 'women';

  return (
    <div className="size-guide-illustration-wrapper">
      <svg
        viewBox="0 0 380 430"
        className="garment-svg"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={`${gender === 'men' ? "Men's" : "Women's"} Shirt Measurement Diagram`}
      >
        <defs>
          {/* Arrow markers */}
          <marker id="arrow-gold" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#c28e5d" />
          </marker>
          <marker id="arrow-gold-start" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse">
            <polygon points="6 0, 0 3, 6 6" fill="#c28e5d" />
          </marker>
          <marker id="arrow-green" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#384935" />
          </marker>
          <marker id="arrow-green-start" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse">
            <polygon points="6 0, 0 3, 6 6" fill="#384935" />
          </marker>
        </defs>

        {/* Soft Background Grid / Card Effect */}
        <rect x="8" y="8" width="364" height="414" rx="12" fill="#faf9f6" stroke="#ede7df" strokeWidth="1" />

        {/* GARMENT OUTLINE: SHIRT */}
        {isWomen ? (
          /* Women's Contoured Shirt / Blouse Outline */
          <g className="garment-silhouette" id="women-shirt-body">
            {/* Main torso with feminine waist taper */}
            <path
              d={`M 125,75 
                 L 85,115 L 60,185 L 90,195 L 115,145 
                 L 118,220 Q 128,260 115,310 
                 L 265,310 Q 252,260 262,220 
                 L 265,145 L 290,195 L 320,185 L 295,115 
                 L 255,75 
                 Q 225,90 190,90 Q 155,90 125,75 Z`}
              fill="#ffffff"
              stroke="#2d3748"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* V-neck / Open collar */}
            <path d="M 155,77 Q 190,118 225,77" fill="#f4efe6" stroke="#2d3748" strokeWidth="1.5" />
            <path d="M 190,118 L 190,310" stroke="#c4beaf" strokeWidth="1.5" strokeDasharray="3 3" />
            {/* Curved bottom hem */}
            <path d="M 115,310 Q 190,325 265,310" fill="none" stroke="#2d3748" strokeWidth="1.5" />
          </g>
        ) : (
          /* Men's Tailored Shirt Silhouette */
          <g className="garment-silhouette" id="men-shirt-body">
            {/* Torso & Sleeves */}
            <path
              d={`M 125,70 
                 L 80,105 L 55,190 L 88,200 L 115,142 
                 L 115,315 
                 L 265,315 
                 L 265,142 L 292,200 L 325,190 L 300,105 
                 L 255,70 
                 Q 225,82 190,82 Q 155,82 125,70 Z`}
              fill="#ffffff"
              stroke="#2d3748"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Crisp collar */}
            <path d="M 152,70 L 175,95 L 190,82 L 205,95 L 228,70 Q 190,85 152,70 Z" fill="#f4efe6" stroke="#2d3748" strokeWidth="1.5" />
            {/* Button Placket */}
            <path d="M 184,82 L 184,315 M 196,82 L 196,315" stroke="#ded8cc" strokeWidth="1" />
            <circle cx="190" cy="115" r="2" fill="#384935" />
            <circle cx="190" cy="150" r="2" fill="#384935" />
            <circle cx="190" cy="185" r="2" fill="#384935" />
            <circle cx="190" cy="220" r="2" fill="#384935" />
            <circle cx="190" cy="255" r="2" fill="#384935" />
            {/* Subtle Pocket on left chest */}
            <path d="M 132,150 L 158,150 L 158,180 L 145,190 L 132,180 Z" fill="#faf9f6" stroke="#ded8cc" strokeWidth="1" />
            {/* Shirttail bottom curve */}
            <path d="M 115,315 Q 190,332 265,315" fill="none" stroke="#2d3748" strokeWidth="1.5" />
          </g>
        )}

        {/* =====================================================
            MEASUREMENT ARROWS & LABELS
           ===================================================== */}

        {/* B. SHOULDER WIDTH (Point to Point across top of shoulder seams) */}
        <g className="measure-dim dim-shoulder">
          <line
            x1="125"
            y1="52"
            x2="255"
            y2="52"
            stroke="#c28e5d"
            strokeWidth="1.8"
            markerStart="url(#arrow-gold-start)"
            markerEnd="url(#arrow-gold)"
          />
          {/* Extension tick lines */}
          <line x1="125" y1="48" x2="125" y2="70" stroke="#c28e5d" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="255" y1="48" x2="255" y2="70" stroke="#c28e5d" strokeWidth="1" strokeDasharray="2 2" />
          {/* Badge B */}
          <circle cx="190" cy="52" r="11" fill="#c28e5d" />
          <text x="190" y="56" fill="#ffffff" fontSize="11" fontWeight="700" textAnchor="middle">B</text>
          <text x="190" y="38" fill="#8c5e31" fontSize="10" fontWeight="600" textAnchor="middle">SHOULDER</text>
        </g>

        {/* A. CHEST (Pit to Pit flat across) */}
        <g className="measure-dim dim-chest">
          <line
            x1="115"
            y1="160"
            x2="265"
            y2="160"
            stroke="#384935"
            strokeWidth="2"
            strokeDasharray="4 2"
            markerStart="url(#arrow-green-start)"
            markerEnd="url(#arrow-green)"
          />
          {/* Badge A */}
          <circle cx="190" cy="160" r="12" fill="#384935" />
          <text x="190" y="164.5" fill="#ffffff" fontSize="11" fontWeight="700" textAnchor="middle">A</text>
          <rect x="160" y="176" width="60" height="16" rx="4" fill="#384935" opacity="0.1" />
          <text x="190" y="188" fill="#384935" fontSize="10" fontWeight="700" textAnchor="middle">CHEST (x2)</text>
        </g>

        {/* C. BODY LENGTH (High shoulder seam down to bottom hem) */}
        <g className="measure-dim dim-length">
          <line
            x1="285"
            y1="72"
            x2="285"
            y2="320"
            stroke="#c28e5d"
            strokeWidth="1.8"
            markerStart="url(#arrow-gold-start)"
            markerEnd="url(#arrow-gold)"
          />
          {/* Ticks */}
          <line x1="255" y1="72" x2="295" y2="72" stroke="#c28e5d" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="265" y1="320" x2="295" y2="320" stroke="#c28e5d" strokeWidth="1" strokeDasharray="2 2" />
          {/* Badge C */}
          <circle cx="285" cy="245" r="11" fill="#c28e5d" />
          <text x="285" y="249" fill="#ffffff" fontSize="11" fontWeight="700" textAnchor="middle">C</text>
          <text x="325" y="249" fill="#8c5e31" fontSize="10" fontWeight="600" textAnchor="start">LENGTH</text>
        </g>

        {/* D. SLEEVE LENGTH (Shoulder seam apex to cuff) */}
        <g className="measure-dim dim-sleeve">
          <line
            x1="110"
            y1="72"
            x2="50"
            y2="175"
            stroke="#384935"
            strokeWidth="1.8"
            markerStart="url(#arrow-green-start)"
            markerEnd="url(#arrow-green)"
          />
          {/* Badge D */}
          <circle cx="75" cy="115" r="11" fill="#384935" />
          <text x="75" y="119" fill="#ffffff" fontSize="11" fontWeight="700" textAnchor="middle">D</text>
          <text x="45" y="102" fill="#384935" fontSize="10" fontWeight="700" textAnchor="middle">SLEEVE</text>
        </g>

        {/* Legend Tag */}
        <g transform="translate(16, 385)">
          <rect x="0" y="0" width="348" height="26" rx="6" fill="#f0ede6" />
          <text x="174" y="17" fill="#5a5246" fontSize="10.5" fontWeight="500" textAnchor="middle">
            GARMENT FLAT DIMENSIONS • ALL MEASUREMENTS IN INCHES / CM
          </text>
        </g>
      </svg>
    </div>
  );
}

/* =========================================================================
   2. PANTS MEASUREMENT ILLUSTRATION (Waist, Hip, Inseam, Outseam)
   ========================================================================= */
function PantsIllustration({ gender = 'men' }) {
  const isWomen = gender === 'women';

  return (
    <div className="size-guide-illustration-wrapper">
      <svg
        viewBox="0 0 380 430"
        className="garment-svg"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={`${gender === 'men' ? "Men's" : "Women's"} Pants Measurement Diagram`}
      >
        <defs>
          <marker id="arrow-gold" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#c28e5d" />
          </marker>
          <marker id="arrow-gold-start" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse">
            <polygon points="6 0, 0 3, 6 6" fill="#c28e5d" />
          </marker>
          <marker id="arrow-green" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#384935" />
          </marker>
          <marker id="arrow-green-start" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse">
            <polygon points="6 0, 0 3, 6 6" fill="#384935" />
          </marker>
        </defs>

        {/* Soft Background Grid */}
        <rect x="8" y="8" width="364" height="414" rx="12" fill="#faf9f6" stroke="#ede7df" strokeWidth="1" />

        {/* GARMENT OUTLINE: TROUSERS / PANTS */}
        <g className="garment-silhouette" id="pants-body">
          {/* Waistband */}
          <path
            d={isWomen
              ? "M 130,55 L 250,55 L 248,78 L 132,78 Z"
              : "M 125,55 L 255,55 L 253,78 L 127,78 Z"
            }
            fill="#f4efe6"
            stroke="#2d3748"
            strokeWidth="1.8"
          />
          {/* Button & Fly */}
          <circle cx="190" cy="66" r="2.5" fill="#384935" />
          <path d="M 190,78 L 190,135 Q 185,150 178,160" stroke="#c4beaf" strokeWidth="1.5" />

          {/* Legs & Crotch */}
          <path
            d={isWomen
              ? `M 132,78 
                 Q 115,120 120,160 
                 L 135,360 L 175,360 L 190,170 L 205,360 L 245,360 
                 L 260,160 Q 265,120 248,78 Z`
              : `M 127,78 
                 L 122,150 
                 L 130,360 L 175,360 L 190,170 L 205,360 L 250,360 
                 L 258,150 L 253,78 Z`
            }
            fill="#ffffff"
            stroke="#2d3748"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Hem details */}
          <line x1="130" y1="355" x2="175" y2="355" stroke="#ded8cc" strokeWidth="1" />
          <line x1="205" y1="355" x2="250" y2="355" stroke="#ded8cc" strokeWidth="1" />
        </g>

        {/* =====================================================
            MEASUREMENT ARROWS & LABELS
           ===================================================== */}

        {/* A. WAIST (Across top waistband) */}
        <g className="measure-dim dim-waist">
          <line
            x1="125"
            y1="40"
            x2="255"
            y2="40"
            stroke="#384935"
            strokeWidth="2"
            markerStart="url(#arrow-green-start)"
            markerEnd="url(#arrow-green)"
          />
          <line x1="125" y1="36" x2="125" y2="55" stroke="#384935" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="255" y1="36" x2="255" y2="55" stroke="#384935" strokeWidth="1" strokeDasharray="2 2" />
          {/* Badge A */}
          <circle cx="190" cy="40" r="11" fill="#384935" />
          <text x="190" y="44" fill="#ffffff" fontSize="11" fontWeight="700" textAnchor="middle">A</text>
          <text x="190" y="26" fill="#384935" fontSize="10" fontWeight="700" textAnchor="middle">WAIST (x2)</text>
        </g>

        {/* B. HIP (Fullest part across hips, ~7-8 in below waist) */}
        <g className="measure-dim dim-hip">
          <line
            x1="118"
            y1="135"
            x2="262"
            y2="135"
            stroke="#c28e5d"
            strokeWidth="1.8"
            strokeDasharray="4 2"
            markerStart="url(#arrow-gold-start)"
            markerEnd="url(#arrow-gold)"
          />
          {/* Badge B */}
          <circle cx="190" cy="135" r="11" fill="#c28e5d" />
          <text x="190" y="139" fill="#ffffff" fontSize="11" fontWeight="700" textAnchor="middle">B</text>
          <text x="190" y="152" fill="#8c5e31" fontSize="10" fontWeight="700" textAnchor="middle">HIP (x2)</text>
        </g>

        {/* C. INSEAM (Crotch down inner leg to bottom hem) */}
        <g className="measure-dim dim-inseam">
          <line
            x1="184"
            y1="172"
            x2="170"
            y2="360"
            stroke="#384935"
            strokeWidth="1.8"
            markerStart="url(#arrow-green-start)"
            markerEnd="url(#arrow-green)"
          />
          {/* Badge C */}
          <circle cx="177" cy="265" r="11" fill="#384935" />
          <text x="177" y="269" fill="#ffffff" fontSize="11" fontWeight="700" textAnchor="middle">C</text>
          <text x="160" y="285" fill="#384935" fontSize="10" fontWeight="700" textAnchor="middle">INSEAM</text>
        </g>

        {/* D. OUTSEAM (Top waistband down outer edge to bottom hem) */}
        <g className="measure-dim dim-outseam">
          <line
            x1="285"
            y1="55"
            x2="285"
            y2="360"
            stroke="#c28e5d"
            strokeWidth="1.8"
            markerStart="url(#arrow-gold-start)"
            markerEnd="url(#arrow-gold)"
          />
          <line x1="255" y1="55" x2="295" y2="55" stroke="#c28e5d" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="250" y1="360" x2="295" y2="360" stroke="#c28e5d" strokeWidth="1" strokeDasharray="2 2" />
          {/* Badge D */}
          <circle cx="285" cy="205" r="11" fill="#c28e5d" />
          <text x="285" y="209" fill="#ffffff" fontSize="11" fontWeight="700" textAnchor="middle">D</text>
          <text x="325" y="209" fill="#8c5e31" fontSize="10" fontWeight="600" textAnchor="start">OUTSEAM</text>
        </g>

        {/* Legend Tag */}
        <g transform="translate(16, 385)">
          <rect x="0" y="0" width="348" height="26" rx="6" fill="#f0ede6" />
          <text x="174" y="17" fill="#5a5246" fontSize="10.5" fontWeight="500" textAnchor="middle">
            GARMENT FLAT DIMENSIONS • ALL MEASUREMENTS IN INCHES / CM
          </text>
        </g>
      </svg>
    </div>
  );
}

/* =========================================================================
   3. KURTA MEASUREMENT ILLUSTRATION (Chest, Shoulder, Length, Sleeve, Hip)
   ========================================================================= */
function KurtaIllustration({ gender = 'men' }) {
  const isWomen = gender === 'women';

  return (
    <div className="size-guide-illustration-wrapper">
      <svg
        viewBox="0 0 380 430"
        className="garment-svg"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={`${gender === 'men' ? "Men's" : "Women's"} Kurta Measurement Diagram`}
      >
        <defs>
          <marker id="arrow-gold" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#c28e5d" />
          </marker>
          <marker id="arrow-gold-start" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse">
            <polygon points="6 0, 0 3, 6 6" fill="#c28e5d" />
          </marker>
          <marker id="arrow-green" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#384935" />
          </marker>
          <marker id="arrow-green-start" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse">
            <polygon points="6 0, 0 3, 6 6" fill="#384935" />
          </marker>
        </defs>

        {/* Background Frame */}
        <rect x="8" y="8" width="364" height="414" rx="12" fill="#faf9f6" stroke="#ede7df" strokeWidth="1" />

        {/* GARMENT OUTLINE: KURTA */}
        <g className="garment-silhouette" id="kurta-body">
          {/* Main Torso & Sleeves */}
          <path
            d={isWomen
              ? `M 130,55 
                 L 85,90 L 58,160 L 88,170 L 115,135 
                 L 120,240 L 105,360 L 275,360 L 260,240 
                 L 265,135 L 292,170 L 322,160 L 295,90 
                 L 250,55 
                 Q 220,68 190,68 Q 160,68 130,55 Z`
              : `M 125,52 
                 L 78,85 L 50,165 L 82,175 L 115,135 
                 L 115,245 L 108,360 L 272,360 L 265,245 
                 L 265,135 L 298,175 L 330,165 L 302,85 
                 L 255,52 
                 Q 225,65 190,65 Q 155,65 125,52 Z`
            }
            fill="#ffffff"
            stroke="#2d3748"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Mandarin / Bandhgala Collar */}
          <path d="M 165,52 Q 190,60 215,52 L 215,44 Q 190,38 165,44 Z" fill="#f4efe6" stroke="#2d3748" strokeWidth="1.5" />
          
          {/* Button placket */}
          <line x1="190" y1="58" x2="190" y2="155" stroke="#2d3748" strokeWidth="1.5" />
          <circle cx="190" cy="80" r="2" fill="#c28e5d" />
          <circle cx="190" cy="105" r="2" fill="#c28e5d" />
          <circle cx="190" cy="130" r="2" fill="#c28e5d" />

          {/* Side Slits / Vents */}
          <line x1="120" y1="240" x2="105" y2="360" stroke="#c28e5d" strokeWidth="2" />
          <line x1="260" y1="240" x2="275" y2="360" stroke="#c28e5d" strokeWidth="2" />
          {/* Slit opening dot indicator */}
          <circle cx="120" cy="240" r="3" fill="#c28e5d" />
          <circle cx="260" cy="240" r="3" fill="#c28e5d" />
        </g>

        {/* =====================================================
            MEASUREMENT ARROWS & LABELS
           ===================================================== */}

        {/* B. SHOULDER WIDTH */}
        <g className="measure-dim dim-shoulder">
          <line
            x1="125"
            y1="32"
            x2="255"
            y2="32"
            stroke="#c28e5d"
            strokeWidth="1.8"
            markerStart="url(#arrow-gold-start)"
            markerEnd="url(#arrow-gold)"
          />
          <line x1="125" y1="28" x2="125" y2="52" stroke="#c28e5d" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="255" y1="28" x2="255" y2="52" stroke="#c28e5d" strokeWidth="1" strokeDasharray="2 2" />
          <circle cx="190" cy="32" r="11" fill="#c28e5d" />
          <text x="190" y="36" fill="#ffffff" fontSize="11" fontWeight="700" textAnchor="middle">B</text>
          <text x="190" y="20" fill="#8c5e31" fontSize="10" fontWeight="600" textAnchor="middle">SHOULDER</text>
        </g>

        {/* A. CHEST (Armpit to armpit x2) */}
        <g className="measure-dim dim-chest">
          <line
            x1="115"
            y1="135"
            x2="265"
            y2="135"
            stroke="#384935"
            strokeWidth="2"
            strokeDasharray="4 2"
            markerStart="url(#arrow-green-start)"
            markerEnd="url(#arrow-green)"
          />
          <circle cx="190" cy="135" r="11" fill="#384935" />
          <text x="190" y="139" fill="#ffffff" fontSize="11" fontWeight="700" textAnchor="middle">A</text>
          <text x="190" y="122" fill="#384935" fontSize="10" fontWeight="700" textAnchor="middle">CHEST / BUST (x2)</text>
        </g>

        {/* E. HIP (Across top of side slits / vents x2) */}
        <g className="measure-dim dim-hip">
          <line
            x1="120"
            y1="240"
            x2="260"
            y2="240"
            stroke="#c28e5d"
            strokeWidth="1.8"
            strokeDasharray="4 2"
            markerStart="url(#arrow-gold-start)"
            markerEnd="url(#arrow-gold)"
          />
          <circle cx="190" cy="240" r="11" fill="#c28e5d" />
          <text x="190" y="244" fill="#ffffff" fontSize="11" fontWeight="700" textAnchor="middle">E</text>
          <text x="190" y="227" fill="#8c5e31" fontSize="10" fontWeight="700" textAnchor="middle">HIP AT SLIT (x2)</text>
        </g>

        {/* C. KURTA LENGTH (High shoulder down to bottom hem) */}
        <g className="measure-dim dim-length">
          <line
            x1="295"
            y1="52"
            x2="295"
            y2="360"
            stroke="#384935"
            strokeWidth="1.8"
            markerStart="url(#arrow-green-start)"
            markerEnd="url(#arrow-green)"
          />
          <line x1="255" y1="52" x2="305" y2="52" stroke="#384935" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="272" y1="360" x2="305" y2="360" stroke="#384935" strokeWidth="1" strokeDasharray="2 2" />
          <circle cx="295" cy="200" r="11" fill="#384935" />
          <text x="295" y="204" fill="#ffffff" fontSize="11" fontWeight="700" textAnchor="middle">C</text>
          <text x="330" y="204" fill="#384935" fontSize="10" fontWeight="700" textAnchor="start">KURTA LENGTH</text>
        </g>

        {/* D. SLEEVE LENGTH */}
        <g className="measure-dim dim-sleeve">
          <line
            x1="105"
            y1="55"
            x2="45"
            y2="155"
            stroke="#c28e5d"
            strokeWidth="1.8"
            markerStart="url(#arrow-gold-start)"
            markerEnd="url(#arrow-gold)"
          />
          <circle cx="70" cy="100" r="11" fill="#c28e5d" />
          <text x="70" y="104" fill="#ffffff" fontSize="11" fontWeight="700" textAnchor="middle">D</text>
          <text x="40" y="86" fill="#8c5e31" fontSize="10" fontWeight="700" textAnchor="middle">SLEEVE</text>
        </g>

        {/* Legend Tag */}
        <g transform="translate(16, 385)">
          <rect x="0" y="0" width="348" height="26" rx="6" fill="#f0ede6" />
          <text x="174" y="17" fill="#5a5246" fontSize="10.5" fontWeight="500" textAnchor="middle">
            GARMENT FLAT DIMENSIONS • ALL MEASUREMENTS IN INCHES / CM
          </text>
        </g>
      </svg>
    </div>
  );
}
