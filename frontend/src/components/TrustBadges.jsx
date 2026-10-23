import React from 'react';
import { TRUST_BADGES } from '../data/mockData';
import './TrustBadges.css';

export default function TrustBadges() {
  const renderIcon = (type) => {
    switch (type) {
      case 'truck':
        return (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="1" y="3" width="15" height="13"></rect>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
            <circle cx="5.5" cy="18.5" r="2.5"></circle>
            <circle cx="18.5" cy="18.5" r="2.5"></circle>
          </svg>
        );
      case 'refresh':
        return (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        );
      case 'shield':
      default:
        return (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <path d="M9 12l2 2 4-4"></path>
          </svg>
        );
    }
  };

  return (
    <section className="aura-trust-section">
      <div className="aura-container">
        <div className="trust-grid">
          {TRUST_BADGES.map((badge) => (
            <div key={badge.id} className="trust-card">
              <div className="trust-icon-box">
                {renderIcon(badge.icon)}
              </div>
              <div className="trust-content">
                <h3 className="trust-title">{badge.title}</h3>
                <p className="trust-desc">{badge.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
