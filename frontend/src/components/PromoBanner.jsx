import React from 'react';
import './PromoBanner.css';

export default function PromoBanner({ onExploreClick }) {
  return (
    <section className="aura-promo-section" id="new-arrivals">
      <div className="aura-container">
        
        {/* Main New Arrivals Banner */}
        <div className="promo-banner-card">
          <div className="promo-image-side">
            <img 
              src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1000&q=80" 
              alt="AURA New Arrivals Collection Rack"
              className="promo-banner-img"
              loading="lazy"
            />
          </div>

          <div className="promo-content-side">
            <span className="promo-eyebrow">JUST DROPPED</span>
            <h2 className="promo-title">New Arrivals</h2>
            <p className="promo-subtitle">Fresh styles for a brighter you</p>
            <p className="promo-text">
              Embrace the season with delicate silhouettes, relaxed proportions, 
              and organic fabrics curated to make every moment feel effortless.
            </p>
            
            <div className="promo-cta-box">
              <button 
                className="btn-primary promo-btn"
                onClick={onExploreClick}
              >
                Explore Collection
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Exclusive Perks Strip */}
        <div className="perks-strip">
          <div className="perk-box">
            <span className="perk-tag">SUSTAINABLE</span>
            <h4>Crafted with Nature</h4>
            <p>100% certified organic cotton and pure linen.</p>
          </div>
          <div className="perk-box">
            <span className="perk-tag">CURATED</span>
            <h4>Artisanal Quality</h4>
            <p>Reinforced stitching designed to last seasons.</p>
          </div>
          <div className="perk-box">
            <span className="perk-tag">FLEXIBLE</span>
            <h4>Tailored Sizing</h4>
            <p>Flattering cuts designed for every body type.</p>
          </div>
        </div>

      </div>
    </section>
  );
}
