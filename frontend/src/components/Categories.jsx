import React from 'react';
import { CATEGORIES } from '../data/mockData';
import './Categories.css';

export default function Categories({ onSelectCategory }) {
  return (
    <section className="aura-categories-section" id="categories">
      <div className="aura-container">
        
        {/* Section Header */}
        <div className="section-header">
          <div>
            <span className="section-eyebrow">COLLECTIONS</span>
            <h2 className="section-title">Shop by Category</h2>
          </div>
          <a href="#all-categories" className="view-all-link">
            View All
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        {/* Categories Grid */}
        <div className="categories-grid">
          {CATEGORIES.map((cat) => (
            <div 
              key={cat.id} 
              className="category-card"
              onClick={() => onSelectCategory && onSelectCategory(cat.name)}
            >
              <div className="cat-image-container">
                <img 
                  src={cat.image} 
                  alt={cat.name} 
                  className="cat-image" 
                  loading="lazy"
                />
                <span className="cat-badge">{cat.itemCount}</span>
              </div>
              
              <div className="cat-info">
                <h3 className="cat-name">{cat.name}</h3>
                <span className="cat-shop-link">
                  Shop Now
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
