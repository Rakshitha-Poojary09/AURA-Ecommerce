import React, { useState } from 'react';
import './Navbar.css';

export default function Navbar({ 
  cartCount = 0, 
  wishlistCount = 0, 
  onSearchClick, 
  currentView = 'home',
  currentCategory = 'All', 
  onNavigate,
  currentUser = null,
  onLogout
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearchClick) onSearchClick(searchQuery);
  };

  const handleNavClick = (view, category = 'All') => {
    if (onNavigate) {
      onNavigate(view, category);
    }
    setMobileMenuOpen(false);
  };

  const isCategoryActive = (cat) => {
    if (currentView !== 'shop') return false;
    if (!currentCategory) return cat.toLowerCase() === 'all';
    return currentCategory.toLowerCase() === cat.toLowerCase();
  };

  return (
    <header className="aura-header">
      {/* Main Navigation Bar */}
      <nav className="main-navbar">
        <div className="aura-container nav-container">
          
          {/* Mobile Menu Hamburger */}
          <button 
            className="mobile-menu-btn" 
            onClick={toggleMobileMenu}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              {mobileMenuOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* Brand Logo */}
          <a 
            href="#" 
            className="brand-logo"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('home');
            }}
          >
            <span className="brand-title">AURA</span>
          </a>

          {/* Desktop Navigation Links */}
          <ul className="nav-links">
            <li>
              <a 
                href="#home" 
                className={`nav-link ${currentView === 'home' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('home');
                }}
              >
                Home
              </a>
            </li>
            <li>
              <a 
                href="#shop" 
                className={`nav-link ${isCategoryActive('all') ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('shop', 'All');
                }}
              >
                Shop
              </a>
            </li>
            <li>
              <a 
                href="#women" 
                className={`nav-link ${isCategoryActive('women') ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('shop', 'Women');
                }}
              >
                Women
              </a>
            </li>
            <li>
              <a 
                href="#men" 
                className={`nav-link ${isCategoryActive('men') ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('shop', 'Men');
                }}
              >
                Men
              </a>
            </li>
            <li>
              <a 
                href="#kids" 
                className={`nav-link ${isCategoryActive('kids') ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('shop', 'Kids');
                }}
              >
                Kids
              </a>
            </li>
            <li className="nav-dropdown">
              <a 
                href="#collections" 
                className="nav-link"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('shop', 'All');
                }}
              >
                Collections
                <svg className="dropdown-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </a>
              <div className="dropdown-menu">
                <a 
                  href="#shop" 
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick('shop', 'All');
                  }}
                >
                  All Products
                </a>
                <a 
                  href="#accessories" 
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick('shop', 'Accessories');
                  }}
                >
                  Accessories
                </a>
                <a 
                  href="#dresses" 
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick('shop', 'Dresses');
                  }}
                >
                  Dresses & Gowns
                </a>
                <a 
                  href="#bestsellers" 
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentView !== 'home') {
                      handleNavClick('home');
                      setTimeout(() => {
                        const el = document.getElementById('bestsellers');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    } else {
                      const el = document.getElementById('bestsellers');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  Bestsellers
                </a>
                <a 
                  href="#new-arrivals" 
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentView !== 'home') {
                      handleNavClick('home');
                      setTimeout(() => {
                        const el = document.getElementById('new-arrivals');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    } else {
                      const el = document.getElementById('new-arrivals');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  New Arrivals
                </a>
              </div>
            </li>
          </ul>

          {/* Right Action Icons */}
          <div className="nav-actions">
            {/* Inline search bar for desktop */}
            <form className={`search-form ${searchOpen ? 'open' : ''}`} onSubmit={handleSearchSubmit}>
              <input
                type="text"
                placeholder="Search styles, clothes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <button 
                type="button" 
                className="search-toggle-btn" 
                onClick={() => setSearchOpen(!searchOpen)}
                aria-label="Search"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </button>
            </form>

            {/* Wishlist Icon */}
            <button 
              className={`icon-btn wishlist-btn ${currentView === 'wishlist' ? 'active' : ''}`} 
              aria-label="Wishlist" 
              title="View Wishlist"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('wishlist');
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill={currentView === 'wishlist' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
              {wishlistCount > 0 && <span className="action-badge">{wishlistCount}</span>}
            </button>

            {/* Shopping Bag / Cart */}
            <button 
              className={`icon-btn cart-btn ${currentView === 'cart' ? 'active' : ''}`} 
              aria-label="Shopping Cart" 
              title="View Shopping Bag"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('cart');
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
              {cartCount > 0 && <span className="action-badge">{cartCount}</span>}
            </button>

            {/* User Account / Admin Dropdown */}
            <div className="account-dropdown-wrapper">
              <button 
                className={`icon-btn user-btn ${currentUser ? 'is-logged-in' : ''} ${['admin', 'account', 'login', 'register'].includes(currentView) ? 'active' : ''}`} 
                aria-label={currentUser ? `Account menu for ${currentUser.name}` : "Account & Admin"} 
                title={currentUser ? `Signed in as ${currentUser.name}` : "Sign In / Account / Admin"}
                onClick={() => setAccountMenuOpen(!accountMenuOpen)}
              >
                {currentUser ? (
                  <span className="user-nav-avatar">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                )}
              </button>

              {/* Account Dropdown Menu */}
              {accountMenuOpen && (
                <>
                  <div 
                    className="account-dropdown-backdrop" 
                    onClick={() => setAccountMenuOpen(false)} 
                  />
                  <div className="account-dropdown-menu">
                    {currentUser ? (
                      <>
                        <div className="dropdown-user-header">
                          <span className="dropdown-greeting">Signed in as</span>
                          <strong className="dropdown-user-name">{currentUser.name}</strong>
                          <span className="dropdown-user-email">{currentUser.email}</span>
                        </div>
                        <div className="dropdown-divider"></div>
                        <button 
                          type="button"
                          className="dropdown-item" 
                          onClick={() => {
                            setAccountMenuOpen(false);
                            handleNavClick('orders');
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <path d="M16 10a4 4 0 0 1-8 0"></path>
                          </svg>
                          My Orders
                        </button>
                        <button 
                          type="button"
                          className="dropdown-item" 
                          onClick={() => {
                            setAccountMenuOpen(false);
                            handleNavClick('wishlist');
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                          </svg>
                          My Wishlist {wishlistCount > 0 ? `(${wishlistCount})` : ''}
                        </button>
                        <button 
                          type="button"
                          className="dropdown-item" 
                          onClick={() => {
                            setAccountMenuOpen(false);
                            handleNavClick('account');
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>
                          My Account
                        </button>
                        <div className="dropdown-divider"></div>
                        <button 
                          type="button"
                          className="dropdown-item logout-item" 
                          onClick={() => {
                            setAccountMenuOpen(false);
                            if (onLogout) onLogout();
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                          </svg>
                          Sign Out
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="dropdown-user-header">
                          <span className="dropdown-greeting">Welcome to AURA</span>
                          <span className="dropdown-sub-greeting">Sign in to track orders & save bag</span>
                        </div>
                        <div className="dropdown-divider"></div>
                        <button 
                          type="button"
                          className="dropdown-item primary-action" 
                          onClick={() => {
                            setAccountMenuOpen(false);
                            handleNavClick('login');
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                            <polyline points="10 17 15 12 10 7"></polyline>
                            <line x1="15" y1="12" x2="3" y2="12"></line>
                          </svg>
                          Sign In
                        </button>
                        <button 
                          type="button"
                          className="dropdown-item" 
                          onClick={() => {
                            setAccountMenuOpen(false);
                            handleNavClick('register');
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="8.5" cy="7" r="4"></circle>
                            <line x1="20" y1="8" x2="20" y2="14"></line>
                            <line x1="23" y1="11" x2="17" y2="11"></line>
                          </svg>
                          Create Account
                        </button>
                        <button 
                          type="button"
                          className="dropdown-item" 
                          onClick={() => {
                            setAccountMenuOpen(false);
                            handleNavClick('wishlist');
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                          </svg>
                          My Wishlist {wishlistCount > 0 ? `(${wishlistCount})` : ''}
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

        </div>

        {/* Mobile Navigation Drawer */}
        <div className={`mobile-nav-drawer ${mobileMenuOpen ? 'open' : ''}`}>
          <form 
            className="mobile-search-form" 
            onSubmit={(e) => {
              e.preventDefault();
              if (onSearchClick) {
                onSearchClick(searchQuery);
                setMobileMenuOpen(false);
              }
            }}
          >
            <div className="mobile-search-input-wrap">
              <input
                type="text"
                placeholder="Search products, styles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search products"
              />
              <button type="submit" className="mobile-search-submit-btn" aria-label="Submit search">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </button>
            </div>
          </form>
          <ul className="mobile-nav-links">
            <li><a href="#" className={currentView === 'home' ? 'active' : ''} onClick={(e) => { e.preventDefault(); handleNavClick('home'); }}>Home</a></li>
            <li><a href="#shop" className={isCategoryActive('all') ? 'active' : ''} onClick={(e) => { e.preventDefault(); handleNavClick('shop', 'All'); }}>Shop All Products</a></li>
            <li><a href="#women" className={isCategoryActive('women') ? 'active' : ''} onClick={(e) => { e.preventDefault(); handleNavClick('shop', 'Women'); }}>Women's Collection</a></li>
            <li><a href="#men" className={isCategoryActive('men') ? 'active' : ''} onClick={(e) => { e.preventDefault(); handleNavClick('shop', 'Men'); }}>Men's Collection</a></li>
            <li><a href="#kids" className={isCategoryActive('kids') ? 'active' : ''} onClick={(e) => { e.preventDefault(); handleNavClick('shop', 'Kids'); }}>Kids Wear</a></li>
            <li><a href="#accessories" className={isCategoryActive('accessories') ? 'active' : ''} onClick={(e) => { e.preventDefault(); handleNavClick('shop', 'Accessories'); }}>Accessories</a></li>
            <li><a href="#wishlist" className={currentView === 'wishlist' ? 'active' : ''} onClick={(e) => { e.preventDefault(); handleNavClick('wishlist'); }}>My Wishlist ({wishlistCount})</a></li>
            <li><a href="#cart" className={currentView === 'cart' ? 'active' : ''} onClick={(e) => { e.preventDefault(); handleNavClick('cart'); }}>My Bag ({cartCount})</a></li>
            
            {/* Mobile Account Links */}
            <li className="mobile-nav-divider"></li>
            {currentUser ? (
              <>
                <li>
                  <a href="#orders" onClick={(e) => { e.preventDefault(); handleNavClick('orders'); }}>
                    My Orders
                  </a>
                </li>
                <li>
                  <a href="#account" onClick={(e) => { e.preventDefault(); handleNavClick('account'); }}>
                    Profile Details
                  </a>
                </li>
                <li>
                  <a href="#logout" onClick={(e) => { e.preventDefault(); if (onLogout) onLogout(); setMobileMenuOpen(false); }}>
                    Sign Out
                  </a>
                </li>
              </>
            ) : (
              <>
                <li>
                  <a href="#login" onClick={(e) => { e.preventDefault(); handleNavClick('login'); }}>
                    Sign In
                  </a>
                </li>
                <li>
                  <a href="#register" onClick={(e) => { e.preventDefault(); handleNavClick('register'); }}>
                    Create Account
                  </a>
                </li>
              </>
            )}
          </ul>
        </div>
      </nav>
    </header>
  );
}
