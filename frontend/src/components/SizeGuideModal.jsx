import React, { useState, useEffect } from 'react';
import './SizeGuideModal.css';
import { SIZE_GUIDES, detectProductGuide, convertToCm, PROVISIONAL_NOTE, MEASUREMENT_ADVICE } from '../data/sizeGuideData';
import GarmentIllustration from './GarmentIllustration';

export default function SizeGuideModal({ isOpen, onClose, product = null, initialGuideId = null }) {
  // Unit state: 'in' (inches) or 'cm' (centimetres)
  const [unit, setUnit] = useState('in');

  // Active guide selection state
  const [selectedGender, setSelectedGender] = useState('men');
  const [selectedGarment, setSelectedGarment] = useState('shirt');

  // Detect product category and initialize active guide when modal opens or product changes
  useEffect(() => {
    if (isOpen) {
      if (initialGuideId && SIZE_GUIDES[initialGuideId]) {
        const g = SIZE_GUIDES[initialGuideId];
        setSelectedGender(g.gender);
        setSelectedGarment(g.garmentType);
      } else if (product) {
        const detectedKey = detectProductGuide(product);
        if (detectedKey && SIZE_GUIDES[detectedKey]) {
          const g = SIZE_GUIDES[detectedKey];
          setSelectedGender(g.gender);
          setSelectedGarment(g.garmentType);
        } else {
          // Default to women if product category says women, else men
          const isWomen = (product.category || '').toLowerCase() === 'women';
          setSelectedGender(isWomen ? 'women' : 'men');
          setSelectedGarment('shirt');
        }
      }
    }
  }, [isOpen, product, initialGuideId]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Active Guide ID constructed from gender and garmentType
  const currentKey = `${selectedGender}_${selectedGarment}`;
  const guide = SIZE_GUIDES[currentKey] || SIZE_GUIDES.men_shirt;

  return (
    <div
      className="size-guide-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="size-guide-dialog-title"
    >
      <div className="size-guide-modal-card">
        {/* Modal Header */}
        <div className="size-guide-header">
          <div className="size-guide-header-title-wrap">
            <span className="size-guide-eyebrow">AURA ATELIER SPECIFICATIONS</span>
            <h2 id="size-guide-dialog-title" className="size-guide-title">
              Size & Fit Guide
            </h2>
            <p className="size-guide-subtitle">
              {guide.displayName} — Tailored Garment Dimensions ({unit === 'in' ? 'Inches' : 'Centimetres'})
            </p>
          </div>

          <button
            type="button"
            className="size-guide-close-btn"
            onClick={onClose}
            aria-label="Close size guide modal"
            id="btn-close-size-guide"
          >
            ✕
          </button>
        </div>

        {/* Navigation & Controls Bar: Gender tabs, Garment types, and Unit Switch */}
        <div className="size-guide-controls-bar">
          {/* Gender Selector */}
          <div className="control-group gender-group" role="tablist" aria-label="Gender selection">
            <button
              type="button"
              className={`selector-tab-btn ${selectedGender === 'men' ? 'active' : ''}`}
              onClick={() => setSelectedGender('men')}
              role="tab"
              aria-selected={selectedGender === 'men'}
            >
              Men's
            </button>
            <button
              type="button"
              className={`selector-tab-btn ${selectedGender === 'women' ? 'active' : ''}`}
              onClick={() => setSelectedGender('women')}
              role="tab"
              aria-selected={selectedGender === 'women'}
            >
              Women's
            </button>
          </div>

          {/* Garment Type Selector */}
          <div className="control-group garment-group" role="tablist" aria-label="Garment category">
            <button
              type="button"
              className={`selector-pill-btn ${selectedGarment === 'shirt' ? 'active' : ''}`}
              onClick={() => setSelectedGarment('shirt')}
              role="tab"
              aria-selected={selectedGarment === 'shirt'}
            >
              👔 Shirts & Tops
            </button>
            <button
              type="button"
              className={`selector-pill-btn ${selectedGarment === 'pants' ? 'active' : ''}`}
              onClick={() => setSelectedGarment('pants')}
              role="tab"
              aria-selected={selectedGarment === 'pants'}
            >
              👖 Pants & Trousers
            </button>
            <button
              type="button"
              className={`selector-pill-btn ${selectedGarment === 'kurta' ? 'active' : ''}`}
              onClick={() => setSelectedGarment('kurta')}
              role="tab"
              aria-selected={selectedGarment === 'kurta'}
            >
              ✨ Kurtas & Tunics
            </button>
          </div>

          {/* Unit Toggle Switch (Inches vs Centimetres) */}
          <div className="unit-toggle-wrapper" aria-label="Unit of measurement">
            <span className="unit-toggle-label">Unit:</span>
            <div className="unit-switch-pill">
              <button
                type="button"
                className={`unit-switch-btn ${unit === 'in' ? 'active' : ''}`}
                onClick={() => setUnit('in')}
                aria-pressed={unit === 'in'}
              >
                Inches (in)
              </button>
              <button
                type="button"
                className={`unit-switch-btn ${unit === 'cm' ? 'active' : ''}`}
                onClick={() => setUnit('cm')}
                aria-pressed={unit === 'cm'}
              >
                Centimetres (cm)
              </button>
            </div>
          </div>
        </div>

        {/* Modal Main Content: Two-column layout (Left: Illustration & How to Measure; Right: Table & Notes) */}
        <div className="size-guide-body-layout">
          {/* LEFT SIDE: Clothing Measurement Illustration & Measurement Guide */}
          <div className="size-guide-visual-col">
            <div className="illustration-card-container">
              <GarmentIllustration garmentType={guide.garmentType} gender={guide.gender} />
            </div>

            {/* How to Measure Details list keyed to Letter Badges */}
            <div className="how-to-measure-section">
              <h4 className="measure-section-title">Where to Measure</h4>
              <ul className="measure-points-list">
                {guide.points.map((pt) => (
                  <li key={pt.letter} className="measure-point-item">
                    <span className="point-badge">{pt.letter}</span>
                    <div className="point-text">
                      <strong className="point-name">{pt.name}:</strong>{' '}
                      <span className="point-instruction">{pt.instruction}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* RIGHT SIDE: Heading, Measurement Table, and Measurement Notes */}
          <div className="size-guide-table-col">
            <div className="table-header-block">
              <div className="table-title-row">
                <h3 className="garment-chart-heading">{guide.displayName} Measurement Chart</h3>
                <span className="unit-indicator-badge">Unit: {unit === 'in' ? 'Inches (in)' : 'Centimetres (cm)'}</span>
              </div>
              <p className="garment-fit-description">{guide.silhouetteNote}</p>
            </div>

            {/* Responsive Measurement Table */}
            <div className="chart-table-responsive-wrapper">
              <table className="aura-size-chart-table">
                <thead>
                  <tr>
                    {guide.columns.map((col) => (
                      <th key={col.key} className={col.isHeader ? 'col-size-name' : ''}>
                        {col.label} {col.isHeader ? '' : `(${unit})`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guide.rows.map((row) => (
                    <tr key={row.size}>
                      <td className="size-pill-cell">
                        <strong className="size-label-token">{row.size}</strong>
                      </td>
                      {guide.columns
                        .filter((c) => !c.isHeader)
                        .map((col) => {
                          const valInches = row[col.key];
                          const displayVal = unit === 'in' ? valInches : convertToCm(valInches);
                          return (
                            <td key={col.key} className="measure-val-cell">
                              {displayVal}
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Measurement Guidance Notes & Advice */}
            <div className="size-guide-guidance-card">
              <div className="guidance-callout-header">
                <span className="callout-icon">📏</span>
                <strong>Garment Measurements vs. Body Measurements</strong>
              </div>
              <p className="guidance-body-text">{MEASUREMENT_ADVICE.garmentVsBody}</p>

              <div className="guidance-tips-list">
                {MEASUREMENT_ADVICE.measuringTips.map((tip, idx) => (
                  <div key={idx} className="tip-row">
                    <span className="tip-bullet">•</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Provisional Standard Sizing Reference Notice */}
            <div className="provisional-notice-banner">
              <div className="notice-icon-box">ℹ️</div>
              <div className="notice-text-content">
                <strong>Provisional Standard Sizing Reference</strong>
                <p>{PROVISIONAL_NOTE}</p>
              </div>
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="size-guide-footer">
          <div className="footer-left-info">
            <span>✨ Crafted according to AURA tailoring standards • Need help? Contact concierge</span>
          </div>
          <button type="button" className="footer-close-btn" onClick={onClose}>
            Close Size Guide
          </button>
        </div>

      </div>
    </div>
  );
}
