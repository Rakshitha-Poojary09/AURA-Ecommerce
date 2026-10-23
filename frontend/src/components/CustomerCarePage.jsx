import React, { useState, useEffect } from 'react';
import './CustomerCarePage.css';
import { SIZE_GUIDES, convertToCm, PROVISIONAL_NOTE, MEASUREMENT_ADVICE } from '../data/sizeGuideData';
import GarmentIllustration from './GarmentIllustration';

export default function CustomerCarePage({ initialTab = 'faq', onNavigate }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const [sizeGender, setSizeGender] = useState('women');
  const [sizeGarment, setSizeGarment] = useState('shirt');
  const [sizeUnit, setSizeUnit] = useState('in');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const toggleFaq = (idx) => {
    setOpenFaqIndex(openFaqIndex === idx ? null : idx);
  };

  const faqs = [
    {
      q: 'How can I track the live status of my order?',
      a: 'You can check your order status anytime by clicking "Order Tracking" in our Customer Care menu or navigating to our dedicated tracking page. Simply enter your Order ID and the email address used during checkout.'
    },
    {
      q: 'What payment options are supported?',
      a: 'We accept all major credit and debit cards (Visa, MasterCard, RuPay, Maestro), UPI (Google Pay, PhonePe, Paytm, BHIM), Net Banking across 50+ Indian banks, and Cash on Delivery (COD) on eligible orders.'
    },
    {
      q: 'Can I cancel or alter my order after placing it?',
      a: 'Orders can be cancelled while their status is "Pending" directly from your Account Dashboard. Once an order moves to "Processing" or "Shipped", it cannot be edited, but you may take advantage of our 14-day return or exchange policy upon arrival.'
    },
    {
      q: 'How do I apply promo codes and coupons?',
      a: 'Enter your coupon code (such as AURA10) in the promo code field during checkout and click "Apply". Valid discounts are instantly subtracted from your subtotal.'
    },
    {
      q: 'Are AURA garments ethically manufactured?',
      a: 'Yes. All AURA garments are crafted with certified organic cotton, linen blends, and low-impact dyes in ethical, fair-wage ateliers in Mumbai. We never mass-produce or compromise on garment workers’ well-being.'
    },
    {
      q: 'What should I do if an item arrives damaged or incorrect?',
      a: 'In the rare event of a defective or incorrect item, please notify us within 48 hours of receipt at concierge@auraclothing.com or call +91 (022) 8920-4100 with photos of the garment. We will promptly dispatch an expedited replacement at no extra charge.'
    }
  ];

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    if (onNavigate) {
      onNavigate('care', tab);
    }
  };

  return (
    <div className="aura-care-page">
      <div className="aura-container care-container">
        {/* Breadcrumb Navigation */}
        <div className="care-breadcrumb">
          <button 
            type="button" 
            className="care-back-link" 
            onClick={() => onNavigate && onNavigate('home')}
          >
            ← Back to Store
          </button>
          <span>/</span>
          <span className="care-current-label">Customer Care</span>
        </div>

        {/* Page Header */}
        <div className="care-header">
          <span className="care-tag">AURA Atelier Concierge</span>
          <h1 className="care-title">Customer Care & Guidelines</h1>
          <p className="care-subtitle">
            Information regarding deliveries, returns, size fittings, and shopping with AURA.
          </p>
        </div>

        {/* Policy Advisory Banner */}
        <div style={{ backgroundColor: '#fffaf0', border: '1px solid #feebc8', borderRadius: '10px', padding: '14px 18px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#7b341e', lineHeight: 1.5 }}>
            <strong>Notice — Requires Business Confirmation:</strong> The standard operating policies, delivery timelines, return periods, and legal terms outlined on this page represent configured application drafts and require commercial verification and legal confirmation by the business before final enactment.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="care-tabs-bar" role="tablist">
          <button 
            type="button"
            role="tab"
            aria-selected={activeTab === 'faq'}
            className={`care-tab-btn ${activeTab === 'faq' ? 'active' : ''}`}
            onClick={() => handleTabClick('faq')}
          >
            <span className="care-tab-icon">❓</span> Customer FAQ
          </button>
          <button 
            type="button"
            role="tab"
            aria-selected={activeTab === 'returns'}
            className={`care-tab-btn ${activeTab === 'returns' ? 'active' : ''}`}
            onClick={() => handleTabClick('returns')}
          >
            <span className="care-tab-icon">🔄</span> Returns & Exchange
          </button>
          <button 
            type="button"
            role="tab"
            aria-selected={activeTab === 'shipping'}
            className={`care-tab-btn ${activeTab === 'shipping' ? 'active' : ''}`}
            onClick={() => handleTabClick('shipping')}
          >
            <span className="care-tab-icon">🚚</span> Shipping Policy
          </button>
          <button 
            type="button"
            role="tab"
            aria-selected={activeTab === 'size-guide'}
            className={`care-tab-btn ${activeTab === 'size-guide' ? 'active' : ''}`}
            onClick={() => handleTabClick('size-guide')}
          >
            <span className="care-tab-icon">📏</span> Size Guide
          </button>
          <button 
            type="button"
            role="tab"
            aria-selected={activeTab === 'terms'}
            className={`care-tab-btn ${activeTab === 'terms' ? 'active' : ''}`}
            onClick={() => handleTabClick('terms')}
          >
            <span className="care-tab-icon">📜</span> Terms & Conditions
          </button>
          <button 
            type="button"
            className="care-tab-btn care-track-quick"
            onClick={() => onNavigate && onNavigate('track')}
          >
            <span className="care-tab-icon">📦</span> Track Order →
          </button>
          <button 
            type="button" 
            className="care-tab-btn care-contact-quick"
            style={{ fontWeight: 600, color: 'var(--color-primary, #384935)', border: '1px solid #384935' }}
            onClick={() => onNavigate && onNavigate('contact')}
          >
            <span className="care-tab-icon">💬</span> Contact Concierge →
          </button>
        </div>

        {/* Content Panel */}
        <div className="care-content-card">
          {/* 1. Customer FAQ */}
          {activeTab === 'faq' && (
            <div className="care-tab-pane">
              <div className="pane-header">
                <h2>Frequently Asked Questions</h2>
                <p>Quick answers to common questions about your orders, accounts, and deliveries.</p>
              </div>

              <div className="faq-list">
                {faqs.map((item, idx) => {
                  const isOpen = openFaqIndex === idx;
                  return (
                    <div key={idx} className={`faq-item ${isOpen ? 'open' : ''}`}>
                      <button 
                        type="button" 
                        className="faq-question-btn" 
                        onClick={() => toggleFaq(idx)}
                        aria-expanded={isOpen}
                      >
                        <span className="faq-question-text">{item.q}</span>
                        <span className="faq-chevron">{isOpen ? '−' : '+'}</span>
                      </button>
                      {isOpen && (
                        <div className="faq-answer-panel">
                          <p>{item.a}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="care-quick-box">
                <h4>Looking for your parcel?</h4>
                <p>Track your shipment in real-time using our live tracking system.</p>
                <button 
                  type="button" 
                  className="care-action-btn"
                  onClick={() => onNavigate && onNavigate('track')}
                >
                  Track Order Now
                </button>
              </div>
            </div>
          )}

          {/* 2. Returns & Exchange */}
          {activeTab === 'returns' && (
            <div className="care-tab-pane">
              <div className="pane-header">
                <h2>Returns & Exchange Policy</h2>
                <p>Shop with confidence. We offer an effortless 14-day doorstep return and exchange service.</p>
              </div>

              <div className="policy-grid">
                <div className="policy-step-card">
                  <span className="step-num">1</span>
                  <h3>14-Day Window</h3>
                  <p>Items may be returned or exchanged within 14 days of delivery provided they are unworn, unwashed, and with tags intact.</p>
                </div>
                <div className="policy-step-card">
                  <span className="step-num">2</span>
                  <h3>Free Reverse Pickup</h3>
                  <p>Our courier associates collect the return parcel directly from your doorstep with zero pickup charges.</p>
                </div>
                <div className="policy-step-card">
                  <span className="step-num">3</span>
                  <h3>Rapid Refund</h3>
                  <p>Once quality-checked at our Mumbai atelier, refunds are credited back to your original payment method in 3–5 business days.</p>
                </div>
              </div>

              <div className="policy-detail-section">
                <h3>How to Initiate a Return or Exchange</h3>
                <ol className="policy-steps-list">
                  <li><strong>Log in to your Account:</strong> Head to your Account Orders section or contact our concierge.</li>
                  <li><strong>Select Items:</strong> Choose the order and items you wish to exchange for another size or return for a refund.</li>
                  <li><strong>Handover Parcel:</strong> Keep the garment in its original cotton bag with tags attached. Our agent will collect it within 24–48 hours.</li>
                </ol>

                <div className="policy-note-box">
                  <strong>Exchange Note:</strong> Complimentary size exchanges are free of cost. If the requested size is unavailable, a full refund will be processed immediately.
                </div>
              </div>
            </div>
          )}

          {/* 3. Shipping Policy */}
          {activeTab === 'shipping' && (
            <div className="care-tab-pane">
              <div className="pane-header">
                <h2>Shipping & Delivery Information</h2>
                <p>Fast, insured, and carbon-conscious shipping across all pin codes in India.</p>
              </div>

              <div className="shipping-highlights">
                <div className="highlight-pill">
                  <strong>✨ Free Delivery</strong> on orders over ₹999
                </div>
                <div className="highlight-pill">
                  <strong>⏱️ 24-Hour Dispatch</strong> on all standard orders
                </div>
                <div className="highlight-pill">
                  <strong>🛡️ Insured Transit</strong> with leading logistics partners
                </div>
              </div>

              <div className="shipping-table-container">
                <table className="shipping-table">
                  <thead>
                    <tr>
                      <th>Destination Region</th>
                      <th>Estimated Delivery</th>
                      <th>Shipping Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Metro Cities</strong> (Mumbai, Delhi, Bengaluru, etc.)</td>
                      <td>2 – 3 Business Days</td>
                      <td>Free over ₹999 / ₹99 standard</td>
                    </tr>
                    <tr>
                      <td><strong>Tier 2 & 3 Cities</strong></td>
                      <td>3 – 5 Business Days</td>
                      <td>Free over ₹999 / ₹99 standard</td>
                    </tr>
                    <tr>
                      <td><strong>Northeast & Remote Locations</strong></td>
                      <td>5 – 7 Business Days</td>
                      <td>Free over ₹999 / ₹99 standard</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="policy-detail-section">
                <h3>Package Tracking & Verification</h3>
                <p>
                  As soon as your package is dispatched, we send an SMS and email notification with your tracking number and carrier details (BlueDart, Delhivery, or Shadowfax). You can also track your shipment status live on our <button type="button" className="inline-link-btn" onClick={() => onNavigate && onNavigate('track')}>Order Tracking</button> page.
                </p>
                <div className="policy-note-box" style={{ marginTop: '16px' }}>
                  <strong>* Policy Advisory (Requires Business Confirmation):</strong> Estimated regional transit durations (2–3 days metro, 3–5 days standard) and complimentary shipping thresholds (₹999) represent preliminary estimates subject to carrier agreements.
                </div>
              </div>
            </div>
          )}

          {/* 4. Size Guide */}
          {activeTab === 'size-guide' && (() => {
            const currentGuideKey = `${sizeGender}_${sizeGarment}`;
            const activeGuide = SIZE_GUIDES[currentGuideKey] || SIZE_GUIDES.women_shirt;

            return (
              <div className="care-tab-pane">
                <div className="pane-header">
                  <h2>Size & Fit Guide</h2>
                  <p>Accurate garment measurement charts for Men's & Women's Shirts, Pants, and Kurtas.</p>
                </div>

                <div className="care-size-guide-controls">
                  {/* Gender Selector */}
                  <div className="size-gender-toggle" role="tablist">
                    <button 
                      type="button" 
                      className={`size-toggle-btn ${sizeGender === 'women' ? 'active' : ''}`}
                      onClick={() => setSizeGender('women')}
                    >
                      Women's
                    </button>
                    <button 
                      type="button" 
                      className={`size-toggle-btn ${sizeGender === 'men' ? 'active' : ''}`}
                      onClick={() => setSizeGender('men')}
                    >
                      Men's
                    </button>
                  </div>

                  {/* Garment Selector */}
                  <div className="care-garment-pills">
                    <button 
                      type="button"
                      className={`care-pill-btn ${sizeGarment === 'shirt' ? 'active' : ''}`}
                      onClick={() => setSizeGarment('shirt')}
                    >
                      👔 Shirts & Tops
                    </button>
                    <button 
                      type="button"
                      className={`care-pill-btn ${sizeGarment === 'pants' ? 'active' : ''}`}
                      onClick={() => setSizeGarment('pants')}
                    >
                      👖 Pants & Trousers
                    </button>
                    <button 
                      type="button"
                      className={`care-pill-btn ${sizeGarment === 'kurta' ? 'active' : ''}`}
                      onClick={() => setSizeGarment('kurta')}
                    >
                      ✨ Kurtas & Tunics
                    </button>
                  </div>

                  {/* Unit Switch */}
                  <div className="care-unit-switch">
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4a5568' }}>Unit:</span>
                    <button
                      type="button"
                      className={`care-unit-btn ${sizeUnit === 'in' ? 'active' : ''}`}
                      onClick={() => setSizeUnit('in')}
                    >
                      Inches (in)
                    </button>
                    <button
                      type="button"
                      className={`care-unit-btn ${sizeUnit === 'cm' ? 'active' : ''}`}
                      onClick={() => setSizeUnit('cm')}
                    >
                      CM (cm)
                    </button>
                  </div>
                </div>

                {/* 2-column layout */}
                <div className="care-size-guide-grid">
                  <div className="care-visual-col">
                    <GarmentIllustration garmentType={activeGuide.garmentType} gender={activeGuide.gender} />
                    
                    <div className="measurement-instructions" style={{ marginTop: '16px' }}>
                      <h3 style={{ margin: '0 0 10px 0', fontSize: '0.95rem' }}>Where to Measure</h3>
                      <ul style={{ paddingLeft: '18px', margin: 0 }}>
                        {activeGuide.points.map((pt) => (
                          <li key={pt.letter} style={{ marginBottom: '6px', fontSize: '0.85rem' }}>
                            <strong>[{pt.letter}] {pt.name}:</strong> {pt.instruction}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="care-table-col">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.15rem' }}>{activeGuide.displayName}</h3>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#384935', background: '#eef3ed', padding: '3px 8px', borderRadius: '4px' }}>
                        Unit: {sizeUnit === 'in' ? 'Inches' : 'Centimetres'}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 14px 0', fontSize: '0.85rem', color: '#6b7280' }}>
                      {activeGuide.silhouetteNote}
                    </p>

                    <div className="size-table-container">
                      <table className="size-guide-table">
                        <thead>
                          <tr>
                            {activeGuide.columns.map((col) => (
                              <th key={col.key}>
                                {col.label} {col.isHeader ? '' : `(${sizeUnit})`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeGuide.rows.map((row) => (
                            <tr key={row.size}>
                              <td><strong>{row.size}</strong></td>
                              {activeGuide.columns.filter((c) => !c.isHeader).map((col) => {
                                const val = sizeUnit === 'in' ? row[col.key] : convertToCm(row[col.key]);
                                return <td key={col.key}>{val}</td>;
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="measurement-instructions">
                      <h3>Garment Measurements vs. Body Measurements</h3>
                      <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#4a5568' }}>
                        {MEASUREMENT_ADVICE.garmentVsBody}
                      </p>
                      <ul style={{ paddingLeft: '18px', margin: 0 }}>
                        {MEASUREMENT_ADVICE.measuringTips.map((tip, idx) => (
                          <li key={idx} style={{ marginBottom: '4px', fontSize: '0.8rem', color: '#6b7280' }}>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div style={{ marginTop: '14px', padding: '12px 16px', background: '#fffdfa', border: '1px dashed #d6b88d', borderRadius: '8px', fontSize: '0.8rem', color: '#8c5e31' }}>
                      <strong>ℹ️ Provisional Standard Sizing Reference</strong>
                      <p style={{ margin: '4px 0 0', color: '#6b7280' }}>{PROVISIONAL_NOTE}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 5. Terms & Conditions */}
          {activeTab === 'terms' && (
            <div className="care-tab-pane">
              <div className="pane-header">
                <h2>Terms & Conditions</h2>
                <p>Last updated: October 2026. Please read these terms carefully before placing an order.</p>
              </div>

              <div className="terms-body">
                <section className="terms-block">
                  <h4>1. General Agreement</h4>
                  <p>
                    By accessing AURA Clothing Co. website or purchasing products, you agree to comply with and be bound by these Terms of Service. AURA reserves the right to update or modify these terms at any time.
                  </p>
                </section>

                <section className="terms-block">
                  <h4>2. Pricing & Payments</h4>
                  <p>
                    All prices are displayed in Indian Rupees (INR) and are inclusive of applicable GST. We reserve the right to correct pricing errors and adjust promotions at our sole discretion.
                  </p>
                </section>

                <section className="terms-block">
                  <h4>3. Intellectual Property</h4>
                  <p>
                    All content, including garment designs, text, photography, brand logos, and artwork, is the exclusive intellectual property of AURA Clothing Co. Unauthorized duplication is strictly prohibited.
                  </p>
                </section>

                <section className="terms-block">
                  <h4>4. Orders & Cancellation</h4>
                  <p>
                    AURA reserves the right to cancel any order due to stock unavailability, suspicious fraudulent activity, or unforeseen logistics constraints. In such circumstances, a full refund is immediately credited.
                  </p>
                </section>

                <div className="policy-note-box" style={{ marginTop: '16px' }}>
                  <strong>* Legal Notice (Requires Business & Legal Confirmation):</strong> These terms and conditions represent template operating terms subject to formal legal review and business confirmation.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Support Concierge Card */}
        <div className="care-contact-card">
          <div className="contact-card-info">
            <h3>Need Personalized Help?</h3>
            <p>Our concierge team is available to assist you with styling advice, orders, or custom sizing queries.</p>
            <div className="contact-details-row">
              <div className="contact-detail-col">
                <span className="detail-label">Phone Support</span>
                <a href="tel:+9102289204100" className="detail-value" style={{ color: '#fff', textDecoration: 'underline' }}>+91 (022) 8920-4100</a>
              </div>
              <div className="contact-detail-col">
                <span className="detail-label">Concierge Email</span>
                <a href="mailto:concierge@auraclothing.com" className="detail-value" style={{ color: '#fff', textDecoration: 'underline' }}>concierge@auraclothing.com</a>
              </div>
              <div className="contact-detail-col">
                <span className="detail-label">Atelier Hours</span>
                <span className="detail-value">Mon – Sat: 9:00 AM – 7:00 PM</span>
              </div>
            </div>
            <div style={{ marginTop: '18px' }}>
              <a 
                href="mailto:concierge@auraclothing.com" 
                className="care-action-btn"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                ✉ Email Atelier Concierge →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
