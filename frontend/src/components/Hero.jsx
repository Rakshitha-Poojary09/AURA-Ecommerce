import React from 'react';
import './Hero.css';

export default function Hero({ onShopNowClick }) {
  return (
    <section className="aura-hero">
      <div className="aura-container hero-container">
        
        {/* Left Text Content */}
        <div className="hero-content">
          <span className="hero-eyebrow">SPRING / SUMMER COLLECTION</span>
          
          <h1 className="hero-brand">AURA</h1>
          <h2 className="hero-title">Style That Feels Like You</h2>
          
          <p className="hero-desc">
            Timeless, Comfortable, Always You. Uniquely curated sustainable silhouettes 
            crafted for effortless elegance and every chapter of your day.
          </p>

          <div className="hero-cta-group">
            <button 
              className="btn-primary hero-btn-main"
              onClick={onShopNowClick}
            >
              Shop Now
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
            <a href="#new-arrivals" className="btn-secondary hero-btn-sub">
              Explore Collection
            </a>
          </div>

          <div className="hero-stats">
            <div className="stat-item">
              <span className="stat-number">50k+</span>
              <span className="stat-label">Happy Clients</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">100%</span>
              <span className="stat-label">Organic Fabrics</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">4.9 ★</span>
              <span className="stat-label">Top Rated</span>
            </div>
          </div>
        </div>

        {/* Right Hero Image */}
        <div className="hero-image-wrapper">
          <div className="hero-image-backdrop"></div>
          <div className="hero-image-card">
            <img 
              src="https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1000&q=85" 
              alt="AURA Spring Summer Collection" 
              className="hero-main-img"
            />
            {/* Floating Tag */}
            <div className="floating-badge">
              <span className="floating-dot"></span>
              <span className="floating-text">Natural Linen & Silk</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
