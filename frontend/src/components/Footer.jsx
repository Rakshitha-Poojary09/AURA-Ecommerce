import React from 'react';
import { FOOTER_LINKS } from '../data/mockData';
import './Footer.css';

export default function Footer({ onSubscribe, onNavigate }) {
  const handleLinkClick = (e, item) => {
    if (onNavigate) {
      if (item.label === 'Home' || item.href === '/') {
        e.preventDefault();
        onNavigate('home');
      } else if (item.label === 'Women Collection' || item.href.includes('category=Women')) {
        e.preventDefault();
        onNavigate('shop', 'Women');
      } else if (item.label === 'Men Collection' || item.href.includes('category=Men')) {
        e.preventDefault();
        onNavigate('shop', 'Men');
      } else if (item.label === 'Kids Wear' || item.href.includes('category=Kids')) {
        e.preventDefault();
        onNavigate('shop', 'Kids');
      } else if (item.label === 'New Arrivals' || item.href.includes('sort=newest')) {
        e.preventDefault();
        onNavigate('shop', 'All', '', 'newest');
      } else if (item.label === 'Seasonal Sale' || item.href.includes('category=Sale')) {
        e.preventDefault();
        onNavigate('shop', 'Sale');
      } else if (item.label === 'Order Tracking' || item.href.includes('view=track')) {
        e.preventDefault();
        onNavigate('track');
      } else if (item.label === 'Customer FAQ' || item.href.includes('tab=faq')) {
        e.preventDefault();
        onNavigate('care', 'faq');
      } else if (item.label === 'Returns & Exchange' || item.href.includes('tab=returns')) {
        e.preventDefault();
        onNavigate('care', 'returns');
      } else if (item.label === 'Shipping Policy' || item.href.includes('tab=shipping')) {
        e.preventDefault();
        onNavigate('care', 'shipping');
      } else if (item.label === 'Size Guide' || item.href.includes('tab=size-guide')) {
        e.preventDefault();
        onNavigate('care', 'size-guide');
      } else if (item.label === 'Terms & Conditions' || item.href.includes('tab=terms')) {
        e.preventDefault();
        onNavigate('care', 'terms');
      }
    }
  };

  return (
    <footer className="aura-footer">
      <div className="aura-container">
        
        {/* Main Footer Content */}
        <div className="footer-top-grid">
          
          {/* Brand Column */}
          <div className="footer-brand-col">
            <a 
              href="/" 
              className="footer-logo"
              onClick={(e) => {
                e.preventDefault();
                if (onNavigate) onNavigate('home');
              }}
              aria-label="AURA Home"
            >
              AURA
            </a>
            <p className="footer-tagline">Fashion for every chapter</p>
            <p className="footer-about">
              Crafting conscious, contemporary clothing that inspires effortless confidence. 
              Designed in Mumbai, delivered worldwide.
            </p>
          </div>

          {/* Quick Links Column */}
          <div className="footer-col">
            <h4 className="footer-col-title">Quick Links</h4>
            <ul className="footer-list">
              {FOOTER_LINKS.quickLinks.map((item, idx) => (
                <li key={idx}>
                  <a href={item.href} onClick={(e) => handleLinkClick(e, item)}>{item.label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Care Column */}
          <div className="footer-col">
            <h4 className="footer-col-title">Customer Care</h4>
            <ul className="footer-list">
              {FOOTER_LINKS.customerCare.map((item, idx) => (
                <li key={idx}>
                  <a href={item.href} onClick={(e) => handleLinkClick(e, item)}>{item.label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Column */}
          <div className="footer-col">
            <h4 className="footer-col-title">Get In Touch</h4>
            <div className="footer-contact-info">
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(FOOTER_LINKS.contact.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-item contact-link"
                title="Search location on Google Maps"
                aria-label={`Search address on Google Maps: ${FOOTER_LINKS.contact.address}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>{FOOTER_LINKS.contact.address}</span>
              </a>

              <a 
                href="tel:+9102289204100" 
                className="contact-item contact-link"
                title="Call AURA Concierge"
                aria-label={`Call AURA concierge at ${FOOTER_LINKS.contact.phone}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                <span>{FOOTER_LINKS.contact.phone}</span>
              </a>

              <a 
                href={`mailto:${FOOTER_LINKS.contact.email}`} 
                className="contact-item contact-link"
                title="Email AURA Concierge"
                aria-label={`Email AURA concierge at ${FOOTER_LINKS.contact.email}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                <span>{FOOTER_LINKS.contact.email}</span>
              </a>
            </div>
          </div>

        </div>

        {/* Footer Bottom Bar */}
        <div className="footer-bottom">
          <p className="footer-copyright">
            © 2026 AURA Clothing Co. All rights reserved.
          </p>

          <div className="footer-socials">
            {/* Instagram */}
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="AURA Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
            </a>
            {/* Facebook */}
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="AURA Facebook">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
              </svg>
            </a>
            {/* Twitter / X */}
            <a href="https://x.com" target="_blank" rel="noopener noreferrer" aria-label="AURA X (Twitter)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
              </svg>
            </a>
            {/* Pinterest */}
            <a href="https://pinterest.com" target="_blank" rel="noopener noreferrer" aria-label="AURA Pinterest">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M8 12h8"></path>
              </svg>
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
}
