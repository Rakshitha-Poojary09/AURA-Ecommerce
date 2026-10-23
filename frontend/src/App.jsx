import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import TrustBadges from './components/TrustBadges';
import Categories from './components/Categories';
import Bestsellers from './components/Bestsellers';
import PromoBanner from './components/PromoBanner';
import Footer from './components/Footer';
import ShopPage from './components/ShopPage';
import ProductDetails from './components/ProductDetails';
import CartPage from './components/CartPage';
import CheckoutPage from './components/CheckoutPage';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import ForgotPasswordPage from './components/ForgotPasswordPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import VerifyEmailPage from './components/VerifyEmailPage';
import AccountPage from './components/AccountPage';
import WishlistPage from './components/WishlistPage';
import TrackOrderPage from './components/TrackOrderPage';
import CustomerCarePage from './components/CustomerCarePage';
import { normalizeProductImageUrl, handleImageError, NEUTRAL_PLACEHOLDER_IMAGE } from './utils/imageUtils';
import { API_BASE } from './utils/apiConfig';

// Helper to normalize product images (local paths and remote URLs)
const normalizeImageUrl = (imageUrl) => {
  return normalizeProductImageUrl(imageUrl);
};

// Helper to safely retrieve temporary Buy Now item from sessionStorage
const getStoredBuyNowItem = () => {
  try {
    const saved = sessionStorage.getItem('aura_buy_now_item');
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === 'object' && parsed.name ? parsed : null;
  } catch (e) {
    return null;
  }
};

// Helper to normalize category naming matching backend MongoDB collections
const normalizeCategory = (cat) => {
  if (!cat) return 'All';
  const clean = cat.trim().toLowerCase();
  if (clean === 'men') return 'Men';
  if (clean === 'kids') return 'Kids';
  if (clean === 'women') return 'Women';
  if (clean === 'accessories') return 'Accessories';
  if (clean === 'sale') return 'Sale';
  if (clean === 'all') return 'All';
  return cat.charAt(0).toUpperCase() + cat.slice(1);
};

// Parse initial navigation and filter state from URL and sessionStorage on initial load / refresh
const getInitialAppState = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const hash = (window.location.hash || '').replace('#', '').toLowerCase();
    const pathname = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';

    let view = params.get('view') || params.get('page');
    let categoryParam = params.get('category');
    let search = params.get('search') || params.get('q') || '';
    let sort = params.get('sort') || 'featured';
    let tab = params.get('tab') || 'faq';
    let productId = params.get('id') || params.get('productId') || null;
    let mode = params.get('mode') || (hash === 'buynow' ? 'buynow' : null);

    let category = categoryParam ? normalizeCategory(categoryParam) : 'All';

    if (!view) {
      if (pathname === '/account/orders' || pathname.startsWith('/account/orders')) {
        view = 'orders';
      } else if (pathname === '/account/returns' || pathname.startsWith('/account/returns')) {
        view = 'returns';
      } else if (pathname === '/account' || pathname.startsWith('/account')) {
        view = 'account';
      } else if (pathname === '/track' || pathname.startsWith('/track')) {
        view = 'track';
      } else if (pathname === '/men') {
        view = 'shop';
        category = 'Men';
      } else if (pathname === '/kids') {
        view = 'shop';
        category = 'Kids';
      } else if (pathname === '/women') {
        view = 'shop';
        category = 'Women';
      } else if (pathname === '/accessories') {
        view = 'shop';
        category = 'Accessories';
      } else if (pathname === '/shop') {
        view = 'shop';
      } else if (pathname === '/cart') {
        view = 'cart';
      } else if (pathname === '/wishlist') {
        view = 'wishlist';
      } else if (pathname === '/checkout') {
        view = 'checkout';
      } else if (pathname === '/login') {
        view = 'login';
      } else if (pathname === '/register') {
        view = 'register';
      } else if (pathname === '/forgot-password' || pathname.startsWith('/forgot-password')) {
        view = 'forgot-password';
      } else if (pathname === '/reset-password' || pathname.startsWith('/reset-password')) {
        view = 'reset-password';
      } else if (pathname === '/verify-email' || pathname.startsWith('/verify-email')) {
        view = 'verify-email';
      } else if (['women', 'men', 'kids', 'accessories'].includes(hash)) {
        view = 'shop';
        category = normalizeCategory(hash);
      } else if (hash === 'new-arrivals' || hash === 'newarrivals') {
        view = 'shop';
        category = 'All';
        sort = 'newest';
      } else if (hash === 'sale' || hash === 'seasonalsale') {
        view = 'shop';
        category = 'Sale';
      } else if (hash === 'shop') {
        view = 'shop';
      } else if (['cart', 'wishlist', 'checkout', 'login', 'register', 'account', 'orders', 'track', 'care', 'forgot-password', 'reset-password', 'verify-email'].includes(hash)) {
        view = hash;
      } else if (['faq', 'returns', 'shipping', 'size-guide', 'terms'].includes(hash)) {
        view = 'care';
        tab = hash;
      } else if (categoryParam) {
        view = 'shop';
      } else if (search) {
        view = 'shop';
      }
    }

    if (!view) {
      const saved = sessionStorage.getItem('aura_shop_filters');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.view) view = parsed.view;
          if (parsed.category) category = normalizeCategory(parsed.category);
          if (parsed.search) search = parsed.search;
          if (parsed.sort) sort = parsed.sort;
        } catch (e) {}
      }
    }

    let token = params.get('token') || '';
    if (!token && (pathname.startsWith('/reset-password/') || pathname.startsWith('/reset/') || pathname.startsWith('/verify-email/'))) {
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        token = parts[1];
      }
    }

    return {
      view: view || 'home',
      category: category || 'All',
      search: search || '',
      sort: sort || 'featured',
      tab: tab || 'faq',
      productId,
      mode,
      token
    };
  } catch (e) {
    return { view: 'home', category: 'All', search: '', sort: 'featured', tab: 'faq', productId: null, mode: null, token: '' };
  }
};

function App() {
  const initialNav = getInitialAppState();
  const [currentView, setCurrentView] = useState(initialNav.view);
  const [shopCategory, setShopCategory] = useState(initialNav.category);
  const [careTab, setCareTab] = useState(initialNav.view === 'care' ? (initialNav.tab || initialNav.category || 'faq') : 'faq');
  const [shopSearch, setShopSearch] = useState(initialNav.search);
  const [shopSort, setShopSort] = useState(initialNav.sort);
  const [resetPasswordToken, setResetPasswordToken] = useState(initialNav.token || '');
  const [verificationToken, setVerificationToken] = useState(initialNav.token || '');
  
  // Authenticated customer state
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  
  // Real MongoDB products state (single source of truth)
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Persistent shopping bag state saved in localStorage so refresh never loses cart
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem('aura_cart_items');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });

  // Sync cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('aura_cart_items', JSON.stringify(cartItems));
    } catch (e) {
      console.warn('Failed to save cart to localStorage:', e);
    }
  }, [cartItems]);

  // Temporary Buy Now item (independent of normal persistent cart)
  const [buyNowItem, setBuyNowItem] = useState(() => {
    return initialNav.view === 'checkout' && initialNav.mode === 'buynow'
      ? getStoredBuyNowItem()
      : null;
  });

  const [appliedCoupon, setAppliedCoupon] = useState(() => {
    try {
      const saved = localStorage.getItem('aura_applied_coupon');
      if (!saved) return null;
      return JSON.parse(saved);
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (appliedCoupon) {
        localStorage.setItem('aura_applied_coupon', JSON.stringify(appliedCoupon));
      } else {
        localStorage.removeItem('aura_applied_coupon');
      }
    } catch (e) {
      console.warn('Failed to save coupon to localStorage:', e);
    }
  }, [appliedCoupon]);

  const [wishlistItems, setWishlistItems] = useState([]); // array of product ID strings
  const [wishlistProducts, setWishlistProducts] = useState([]); // populated Product objects
  const [toastMessage, setToastMessage] = useState('');

  // Guest Wishlist localStorage helpers
  const getGuestWishlist = () => {
    try {
      const saved = localStorage.getItem('aura_guest_wishlist');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (e) {
      return [];
    }
  };

  const setGuestWishlist = (ids) => {
    try {
      localStorage.setItem('aura_guest_wishlist', JSON.stringify(ids));
    } catch (e) {
      console.warn('Failed to save guest wishlist:', e);
    }
  };

  // Fetch authenticated or guest wishlist
  const fetchWishlist = async (user = currentUser, currentCatalog = products) => {
    if (user) {
      try {
        const response = await fetch(`${API_BASE}/api/wishlist`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          const valid = Array.isArray(data.wishlist) ? data.wishlist : [];
          setWishlistProducts(valid);
          setWishlistItems(valid.map((p) => String(p._id || p.id)));
          return;
        }
      } catch (err) {
        console.warn('Error fetching backend wishlist:', err);
      }
    }

    // Guest fallback
    const guestIds = getGuestWishlist();
    setWishlistItems(guestIds);
    const catalogToUse = currentCatalog && currentCatalog.length > 0 ? currentCatalog : products;
    const populated = guestIds
      .map((id) => catalogToUse.find((p) => String(p._id || p.id) === String(id)))
      .filter(Boolean);
    setWishlistProducts(populated);
  };

  // Fetch all products from MongoDB API
  const fetchProducts = async () => {
    setProductsLoading(true);
    setProductsError(null);
    try {
      const response = await fetch(`${API_BASE}/api/products`);
      if (!response.ok) {
        throw new Error(`Failed to load products (HTTP ${response.status})`);
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        const formatted = data.map((item, index) => {
          const isAccessory = (item.category || '').trim().toLowerCase() === 'accessories';
          const validColors = isAccessory
            ? ((Array.isArray(item.colorVariants) && item.colorVariants.length > 0)
                ? item.colorVariants.map(v => v.colorCode || v.colorName).filter(Boolean)
                : (Array.isArray(item.colors) ? item.colors.filter(Boolean) : []))
            : [];
          return {
            ...item,
            id: item._id || item.id || `mongo-${index}`,
            _id: item._id || item.id,
            subCategory: item.subCategory || item.category,
            image: normalizeImageUrl(item.image),
            price: Number(item.price) || 0,
            mrp: item.mrp !== undefined && item.mrp !== null ? Number(item.mrp) : (item.originalPrice ? Number(item.originalPrice) : null),
            originalPrice: item.mrp !== undefined && item.mrp !== null ? Number(item.mrp) : (item.originalPrice ? Number(item.originalPrice) : null),
            rating: typeof item.rating === 'number' ? item.rating : 0,
            reviewsCount: typeof item.reviewsCount === 'number' ? item.reviewsCount : 0,
            isNew: item.isNew !== undefined ? item.isNew : false,
            colors: validColors,
            sizes: isAccessory ? ['One Size'] : (Array.isArray(item.sizes) && item.sizes.length > 0 ? item.sizes : ['S', 'M', 'L', 'XL']),
          };
        });
        setProducts(formatted);
        if (formatted.length > 0) {
          setSelectedProduct((prev) => {
            if (initialNav.productId) {
              const matched = formatted.find(
                (p) => String(p._id) === String(initialNav.productId) || String(p.id) === String(initialNav.productId)
              );
              if (matched) return matched;
            }
            if (!prev) return formatted[0];
            const updated = formatted.find(
              (p) => (p._id && (p._id === prev._id || p._id === prev.id)) || 
                     (p.id && (p.id === prev.id || p.id === prev._id))
            );
            return updated || prev;
          });
        }
      } else {
        setProducts([]);
      }
    } catch (err) {
      console.warn('Backend unavailable to fetch products:', err);
      setProductsError('Could not connect to the product catalog. Please make sure the backend server is running.');
    } finally {
      setProductsLoading(false);
    }
  };

  // Check existing session via HTTP-only cookie on application mount
  const checkAuthSession = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          setCurrentUser(data.user);
        }
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      setCurrentUser(null);
    } finally {
      setIsAuthChecking(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    checkAuthSession();
  }, []);

  // Protect /account and /account/orders: Redirect guest to login
  useEffect(() => {
    if (!isAuthChecking && !currentUser && (currentView === 'account' || currentView === 'orders')) {
      showToast('Please sign in to access your AURA account.');
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', '/login');
      }
      setCurrentView('login');
    }
  }, [isAuthChecking, currentUser, currentView]);

  // Sync wishlist whenever user changes or products catalog loads
  useEffect(() => {
    if (currentUser) {
      fetchWishlist(currentUser, products);
    } else {
      const guestIds = getGuestWishlist();
      setWishlistItems(guestIds);
      const populated = guestIds
        .map((id) => products.find((p) => String(p._id || p.id) === String(id)))
        .filter(Boolean);
      setWishlistProducts(populated);
    }
  }, [currentUser, products]);

  // Authentication callbacks
  const handleLoginSuccess = async (user) => {
    setCurrentUser(user);
    showToast(`Welcome back, ${user.name}! ✨`);

    // Safely merge guest wishlist if any exists in localStorage
    const guestIds = getGuestWishlist();
    if (guestIds.length > 0) {
      try {
        const response = await fetch(`${API_BASE}/api/wishlist/merge`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ productIds: guestIds }),
        });
        if (response.ok) {
          const data = await response.json();
          localStorage.removeItem('aura_guest_wishlist');
          const valid = Array.isArray(data.wishlist) ? data.wishlist : [];
          setWishlistProducts(valid);
          setWishlistItems(valid.map((p) => String(p._id || p.id)));
          showToast('Guest wishlist merged with your account ❤️');
        } else {
          fetchWishlist(user, products);
        }
      } catch (e) {
        fetchWishlist(user, products);
      }
    } else {
      fetchWishlist(user, products);
    }

    handleNavigate('account');
  };

  const handleRegisterSuccess = async (user) => {
    setCurrentUser(user);
    showToast(`Welcome to AURA, ${user.name}! Account created ✨`);

    // Safely merge guest wishlist if any exists in localStorage
    const guestIds = getGuestWishlist();
    if (guestIds.length > 0) {
      try {
        const response = await fetch(`${API_BASE}/api/wishlist/merge`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ productIds: guestIds }),
        });
        if (response.ok) {
          const data = await response.json();
          localStorage.removeItem('aura_guest_wishlist');
          const valid = Array.isArray(data.wishlist) ? data.wishlist : [];
          setWishlistProducts(valid);
          setWishlistItems(valid.map((p) => String(p._id || p.id)));
        } else {
          fetchWishlist(user, products);
        }
      } catch (e) {
        fetchWishlist(user, products);
      }
    } else {
      fetchWishlist(user, products);
    }

    handleNavigate('account');
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      // Ignore network errors on logout
    }
    setCurrentUser(null);
    // Revert to local guest storage
    const guestIds = getGuestWishlist();
    setWishlistItems(guestIds);
    setWishlistProducts(
      guestIds.map((id) => products.find((p) => String(p._id || p.id) === String(id))).filter(Boolean)
    );
    showToast('You have been signed out.');

    // Replace current history entry so browser Back button cannot restore protected account pages
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', '/login');
    }
    setCurrentView('login');
  };

  // Dynamically computed cart items count for the navbar
  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  // Show a temporary toast notification for user feedback
  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  // Add product to cart handler (supports size and quantity based on PRODUCT + SELECTED SIZE)
  const handleAddToCart = (product, qty = 1, showFeedback = true) => {
    const liveProd = products.find(
      (p) => (p._id && (p._id === product._id || p._id === product.id)) ||
             (p.id && (p.id === product.id || p.id === product._id)) ||
             p.name === product.name
    );

    const isAccessory = (liveProd?.category || product.category || '').toLowerCase() === 'accessories';
    const chosenSize = (product.selectedSize || product.size || (isAccessory ? 'One Size' : (product.sizes?.length === 1 ? product.sizes[0] : 'M'))).toString().trim();
    const chosenColor = (isAccessory && (product.colorName || product.selectedColor || product.color) ? (product.colorName || product.selectedColor || product.color) : 'Standard').toString().trim();
    const realId = liveProd?._id || liveProd?.id || product._id || product.id;
    const itemKey = `${realId}-${chosenSize}-${chosenColor}`;

    // Color variant matching - strictly for Accessories
    const colorVariantsSource = isAccessory ? (liveProd?.colorVariants || product.colorVariants) : [];
    const matchedVariant = Array.isArray(colorVariantsSource) && colorVariantsSource.length > 0
      ? colorVariantsSource.find(
          (v) => (v.colorName && v.colorName.toLowerCase() === chosenColor.toLowerCase()) ||
                 (v.colorCode && v.colorCode.toLowerCase() === chosenColor.toLowerCase())
        )
      : null;

    const sizeStockSource = liveProd?.sizeStock || product.sizeStock;
    let maxStock;
    if (matchedVariant && typeof matchedVariant.stock === 'number') {
      maxStock = matchedVariant.stock;
    } else if (sizeStockSource && typeof sizeStockSource[chosenSize] === 'number') {
      maxStock = sizeStockSource[chosenSize];
    } else if (typeof liveProd?.stock === 'number') {
      maxStock = liveProd.stock;
    } else if (typeof product.stock === 'number') {
      maxStock = product.stock;
    } else {
      maxStock = 20;
    }

    if (maxStock <= 0) {
      const variantDetail = chosenColor && chosenColor !== 'Standard' ? ` in Colour ${chosenColor}` : ` in Size ${chosenSize}`;
      showToast(`"${product.name}"${variantDetail} is currently out of stock.`);
      return false;
    }

    const count = typeof qty === 'number' && qty > 0 ? qty : 1;

    // Check existing item quantity in current cart
    const existing = cartItems.find((item) => item.cartItemId === itemKey);
    const currentQty = existing ? (Number(existing.quantity) || 0) : 0;
    if (currentQty + count > maxStock) {
      const detailStr = chosenColor && chosenColor !== 'Standard' ? `Colour ${chosenColor}` : `Size ${chosenSize}`;
      showToast(`Cannot add ${count} more. Only ${maxStock} in stock for ${detailStr} (you already have ${currentQty} in bag).`);
      return false;
    }

    const authoritativePrice = liveProd ? Number(liveProd.price) : (Number(product.price) || 0);
    const authoritativeMrp = liveProd && liveProd.mrp !== undefined && liveProd.mrp !== null
      ? Number(liveProd.mrp)
      : (product.mrp ? Number(product.mrp) : (product.originalPrice ? Number(product.originalPrice) : null));

    setCartItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (item) => item.cartItemId === itemKey
      );

      if (existingIndex > -1) {
        const updated = [...prevItems];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + count,
          price: authoritativePrice,
          mrp: authoritativeMrp,
          stock: maxStock,
        };
        return updated;
      } else {
        const newItem = {
          id: realId,
          _id: realId,
          productId: realId,
          cartItemId: itemKey,
          name: liveProd?.name || product.name,
          category: liveProd?.category || product.category || 'Collection',
          price: authoritativePrice,
          mrp: authoritativeMrp,
          originalPrice: authoritativeMrp,
          discount: product.discount,
          image: isAccessory && matchedVariant?.image ? matchedVariant.image : (product.image || liveProd?.image),
          size: chosenSize,
          selectedSize: chosenSize,
          selectedColor: isAccessory && chosenColor !== 'Standard' ? chosenColor : '',
          color: isAccessory && chosenColor !== 'Standard' ? chosenColor : '',
          colorName: isAccessory ? (matchedVariant?.colorName || product.colorName || (chosenColor !== 'Standard' ? chosenColor : '')) : '',
          colorCode: isAccessory ? (matchedVariant?.colorCode || product.colorCode || '') : '',
          quantity: count,
          stock: maxStock,
          sizeStock: sizeStockSource || {},
        };
        return [...prevItems, newItem];
      }
    });

    if (showFeedback) {
      const colorStr = chosenColor && chosenColor !== 'Standard' ? ` - ${chosenColor}` : '';
      const sizeStr = chosenSize && chosenSize !== 'One Size' ? ` (${chosenSize})` : '';
      const qtyStr = count > 1 ? `${count}x ` : '';
      showToast(`Added ${qtyStr}"${product.name}"${colorStr}${sizeStr} to your bag! 🛍️`);
    }
    return true;
  };

  // Update item quantity in cart
  const handleUpdateQuantity = (cartItemId, delta) => {
    setCartItems((prevItems) => {
      return prevItems
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const liveProd = products.find(
              (p) => (p._id && (p._id === item.productId || p._id === item._id || p._id === item.id)) ||
                     (p.id && (p.id === item.productId || p.id === item._id || p.id === item.id)) ||
                     p.name === item.name
            );
            const isAccessory = (liveProd?.category || item.category || '').toLowerCase() === 'accessories';
            const chosenSize = (item.selectedSize || item.size || (isAccessory ? 'One Size' : 'M')).toString().trim();
            const chosenColor = (isAccessory ? (item.colorName || item.selectedColor || item.color || '') : '').toString().trim();

            const colorVariantsSource = isAccessory ? (liveProd?.colorVariants || item.colorVariants) : [];
            const matchedVariant = Array.isArray(colorVariantsSource) && colorVariantsSource.length > 0
              ? colorVariantsSource.find(
                  (v) => (v.colorName && v.colorName.toLowerCase() === chosenColor.toLowerCase()) ||
                         (v.colorCode && v.colorCode.toLowerCase() === chosenColor.toLowerCase())
                )
              : null;

            const sizeStockSource = liveProd?.sizeStock || item.sizeStock;
            let maxStock;
            if (matchedVariant && typeof matchedVariant.stock === 'number') {
              maxStock = matchedVariant.stock;
            } else if (sizeStockSource && typeof sizeStockSource[chosenSize] === 'number') {
              maxStock = sizeStockSource[chosenSize];
            } else if (typeof liveProd?.stock === 'number') {
              maxStock = liveProd.stock;
            } else if (typeof item.stock === 'number') {
              maxStock = item.stock;
            } else {
              maxStock = 20;
            }

            const newQty = item.quantity + delta;
            if (delta > 0 && newQty > maxStock) {
              const detailStr = chosenColor && chosenColor !== 'Standard' ? `Colour ${chosenColor}` : `Size ${chosenSize}`;
              showToast(`Only ${maxStock} units available for "${item.name}" (${detailStr}).`);
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty, stock: maxStock } : null;
          }
          return item;
        })
        .filter(Boolean);
    });
  };

  // Remove individual item from cart
  const handleRemoveFromCart = (cartItemId) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.cartItemId !== cartItemId));
    showToast('Removed item from your bag.');
  };

  // Move item from cart to wishlist
  const handleMoveToWishlist = (item, cartItemId) => {
    handleRemoveFromCart(cartItemId);
    const prodId = String(item.productId || item._id || item.id);
    const isAlreadyWishlisted = wishlistItems.some((id) => String(id) === prodId);
    if (!isAlreadyWishlisted) {
      handleToggleWishlist(item);
    } else {
      showToast(`"${item.name}" is already in your wishlist! ❤️`);
    }
  };

  // Toggle wishlist item handler (handles both guests and authenticated customers)
  const handleToggleWishlist = async (product) => {
    const prodId = String(product._id || product.id);

    if (currentUser) {
      try {
        const response = await fetch(`${API_BASE}/api/wishlist/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ productId: prodId }),
        });
        if (response.ok) {
          const data = await response.json();
          const valid = Array.isArray(data.wishlist) ? data.wishlist : [];
          setWishlistProducts(valid);
          setWishlistItems(valid.map((p) => String(p._id || p.id)));
          showToast(data.message || (data.isAdded ? `Saved "${product.name}" to your wishlist! ❤️` : 'Removed from wishlist.'));
        } else {
          showToast('Could not update wishlist.');
        }
      } catch (err) {
        showToast('Network error updating wishlist.');
      }
    } else {
      // Guest local storage
      const currentIds = getGuestWishlist();
      const exists = currentIds.some((id) => String(id) === prodId);
      let updatedIds;
      if (exists) {
        updatedIds = currentIds.filter((id) => String(id) !== prodId);
        showToast(`Removed from wishlist.`);
      } else {
        updatedIds = [...currentIds, prodId];
        showToast(`Saved "${product.name}" to your wishlist! ❤️`);
      }
      setGuestWishlist(updatedIds);
      setWishlistItems(updatedIds);
      setWishlistProducts(
        updatedIds.map((id) => products.find((p) => String(p._id || p.id) === String(id))).filter(Boolean)
      );
    }
  };

  // Explicitly remove product from wishlist
  const handleRemoveFromWishlist = async (product) => {
    const prodId = String(product._id || product.id);

    if (currentUser) {
      try {
        const response = await fetch(`${API_BASE}/api/wishlist/${prodId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          const valid = Array.isArray(data.wishlist) ? data.wishlist : [];
          setWishlistProducts(valid);
          setWishlistItems(valid.map((p) => String(p._id || p.id)));
          showToast(`Removed "${product.name}" from wishlist.`);
        } else {
          showToast('Could not remove item from wishlist.');
        }
      } catch (err) {
        showToast('Network error removing item.');
      }
    } else {
      const currentIds = getGuestWishlist();
      const updatedIds = currentIds.filter((id) => String(id) !== prodId);
      setGuestWishlist(updatedIds);
      setWishlistItems(updatedIds);
      setWishlistProducts(
        updatedIds.map((id) => products.find((p) => String(p._id || p.id) === String(id))).filter(Boolean)
      );
      showToast(`Removed "${product.name}" from wishlist.`);
    }
  };

  // Synchronize state with browser URL search parameters and session cache
  const syncUrlState = (view, category = 'All', search = '', sort = 'featured', prodId = null, mode = null, replace = false) => {
    try {
      let targetPath = '/';
      const params = new URLSearchParams();

      if (view === 'account') {
        targetPath = '/account';
      } else if (view === 'orders') {
        targetPath = '/account/orders';
      } else if (view === 'returns') {
        targetPath = '/account/returns';
      } else if (view === 'track') {
        targetPath = '/track';
      } else if (view === 'care') {
        targetPath = '/';
        params.set('view', 'care');
        if (category && category !== 'All') params.set('tab', category);
      } else if (view === 'checkout') {
        targetPath = '/';
        params.set('view', 'checkout');
        if (mode === 'buynow') params.set('mode', 'buynow');
      } else if (view === 'shop') {
        targetPath = '/';
        params.set('view', 'shop');
        if (category && category !== 'All') params.set('category', category);
        if (search && search.trim()) params.set('search', search.trim());
        if (sort && sort !== 'featured') params.set('sort', sort);
        sessionStorage.setItem('aura_shop_filters', JSON.stringify({
          view: 'shop',
          category: category || 'All',
          search: search || '',
          sort: sort || 'featured'
        }));
      } else if (view === 'product') {
        targetPath = '/';
        params.set('view', 'product');
        if (prodId) params.set('id', prodId);
      } else if (view === 'reset-password') {
        targetPath = '/reset-password';
        if (prodId) {
          // prodId used as token carrier if passed
          params.set('token', prodId);
          setResetPasswordToken(prodId);
        } else if (resetPasswordToken) {
          params.set('token', resetPasswordToken);
        }
      } else if (view === 'verify-email') {
        targetPath = '/verify-email';
        if (prodId) {
          params.set('token', prodId);
          setVerificationToken(prodId);
        } else if (verificationToken) {
          params.set('token', verificationToken);
        }
      } else if (view === 'forgot-password') {
        targetPath = '/forgot-password';
      } else if (view !== 'home') {
        targetPath = '/';
        params.set('view', view);
      } else {
        targetPath = '/';
      }

      if (view !== 'shop') {
        sessionStorage.removeItem('aura_shop_filters');
      }

      const queryString = params.toString();
      const newUrl = queryString ? `${targetPath}?${queryString}` : targetPath;
      const currentUrl = window.location.pathname + window.location.search;

      if (currentUrl !== newUrl) {
        if (replace) {
          window.history.replaceState(null, '', newUrl);
        } else {
          window.history.pushState(null, '', newUrl);
        }
      }
    } catch (e) {
      console.warn('Could not sync URL state:', e);
    }
  };

  // Listen for browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const state = getInitialAppState();
      // Block browser Back button into protected account routes if logged out
      if (!currentUser && (state.view === 'account' || state.view === 'orders' || state.view === 'returns')) {
        setCurrentView('login');
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', '/login');
        }
        return;
      }
      setCurrentView(state.view);
      if (state.token) {
        setResetPasswordToken(state.token);
        setVerificationToken(state.token);
      }
      if (state.view === 'checkout' && state.mode === 'buynow') {
        const stored = getStoredBuyNowItem();
        setBuyNowItem(stored);
      } else if (state.view !== 'checkout') {
        setBuyNowItem(null);
        try {
          sessionStorage.removeItem('aura_buy_now_item');
        } catch (e) {}
      }
      if (state.view === 'care') {
        setCareTab(state.category || 'faq');
      } else {
        setShopCategory(state.category);
      }
      setShopSearch(state.search);
      setShopSort(state.sort);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser]);

  // Filter change callback from ShopPage (memoized to prevent child effect triggers)
  const handleShopFilterChange = React.useCallback(({ category, search, sort }) => {
    setShopCategory(category);
    setShopSearch(search);
    setShopSort(sort);
    syncUrlState('shop', category, search, sort, null, null, true);
  }, []);

  // Navigation handler between Home, Shop, Product Details, and Cart
  const handleNavigate = (view, category = 'All', search = '', sort = null) => {
    if (view !== 'checkout' && buyNowItem) {
      setBuyNowItem(null);
      try {
        sessionStorage.removeItem('aura_buy_now_item');
      } catch (e) {}
    }
    setCurrentView(view);
    const effectiveCategory = category || 'All';
    if (view === 'care') {
      setCareTab(category || 'faq');
    } else {
      setShopCategory(effectiveCategory);
    }
    setShopSearch(search || '');
    const effectiveSort = sort || (view === 'shop' ? shopSort : 'featured');
    if (sort) {
      setShopSort(sort);
    } else if (view !== 'shop') {
      setShopSort('featured');
    }
    syncUrlState(view, effectiveCategory, search || '', effectiveSort, null, null, false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open Product Details page for a selected product
  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setCurrentView('product');
    const prodId = product._id || product.id;
    syncUrlState('product', 'All', '', 'featured', prodId, null, false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCategory = (categoryName) => {
    handleNavigate('shop', categoryName, '');
    showToast(`Showing collection for: ${categoryName}`);
  };

  const handleCheckout = () => {
    setBuyNowItem(null);
    try {
      sessionStorage.removeItem('aura_buy_now_item');
    } catch (e) {}
    setCurrentView('checkout');
    syncUrlState('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle Buy Now: Put item in temporary Buy Now state without modifying normal persistent cart
  const handleBuyNow = (productItem) => {
    if (!productItem) return;
    const qty = typeof productItem?.quantity === 'number' && productItem.quantity > 0 ? productItem.quantity : 1;
    const itemWithQty = { ...productItem, quantity: qty };
    setBuyNowItem(itemWithQty);
    try {
      sessionStorage.setItem('aura_buy_now_item', JSON.stringify(itemWithQty));
    } catch (e) {}

    // Direct navigation to checkout showing the Buy Now item alone
    setCurrentView('checkout');
    syncUrlState('checkout', 'All', '', 'featured', null, 'buynow');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelBuyNow = () => {
    setBuyNowItem(null);
    try {
      sessionStorage.removeItem('aura_buy_now_item');
    } catch (e) {}
    handleNavigate('shop');
  };

  return (
    <div className="aura-app">
      {/* 1. Navbar with active view, category, cart & wishlist counts, and authentication status */}
      <Navbar 
        currentView={currentView}
        currentCategory={shopCategory}
        onNavigate={handleNavigate}
        cartCount={cartCount} 
        wishlistCount={wishlistItems.length}
        currentUser={currentUser}
        onLogout={handleLogout}
        onSearchClick={(query) => {
          handleNavigate('shop', 'All', query);
          showToast(`Searching for "${query}" in shop... ✨`);
        }}
      />

      {/* Main Page Content - Conditional Rendering between Views */}
      {currentView === 'login' ? (
        <main>
          <LoginPage 
            onNavigate={handleNavigate}
            onLoginSuccess={handleLoginSuccess}
          />
        </main>
      ) : currentView === 'forgot-password' ? (
        <main>
          <ForgotPasswordPage 
            onNavigate={handleNavigate}
          />
        </main>
      ) : currentView === 'reset-password' ? (
        <main>
          <ResetPasswordPage 
            token={resetPasswordToken}
            onNavigate={handleNavigate}
          />
        </main>
      ) : currentView === 'verify-email' ? (
        <main>
          <VerifyEmailPage 
            token={verificationToken}
            onNavigate={handleNavigate}
          />
        </main>
      ) : currentView === 'register' ? (
        <main>
          <RegisterPage 
            onNavigate={handleNavigate}
            onRegisterSuccess={handleRegisterSuccess}
          />
        </main>
      ) : currentView === 'orders' ? (
        <main>
          <AccountPage 
            user={currentUser}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
            onUserUpdate={(updatedUser) => setCurrentUser(updatedUser)}
            wishlistCount={wishlistItems.length}
            initialTab="orders"
          />
        </main>
      ) : currentView === 'returns' ? (
        <main>
          <AccountPage 
            user={currentUser}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
            onUserUpdate={(updatedUser) => setCurrentUser(updatedUser)}
            wishlistCount={wishlistItems.length}
            initialTab="returns"
          />
        </main>
      ) : currentView === 'account' ? (
        <main>
          <AccountPage 
            user={currentUser}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
            onUserUpdate={(updatedUser) => setCurrentUser(updatedUser)}
            wishlistCount={wishlistItems.length}
            initialTab="overview"
          />
        </main>
      ) : currentView === 'checkout' ? (
        <main>
          <CheckoutPage 
            cartItems={buyNowItem ? [buyNowItem] : cartItems}
            isBuyNow={Boolean(buyNowItem)}
            onCancelBuyNow={handleCancelBuyNow}
            currentUser={currentUser}
            onNavigate={(dest, cat, search, sort) => {
              if (buyNowItem) {
                setBuyNowItem(null);
                try {
                  sessionStorage.removeItem('aura_buy_now_item');
                } catch (e) {}
              }
              handleNavigate(dest, cat, search, sort);
            }}
            appliedCoupon={appliedCoupon}
            onApplyCoupon={setAppliedCoupon}
            onRemoveCoupon={() => setAppliedCoupon(null)}
            onRemoveItem={(itemToRemove) => {
              if (buyNowItem) {
                setBuyNowItem(null);
                try {
                  sessionStorage.removeItem('aura_buy_now_item');
                } catch (e) {}
                showToast('Removed item from checkout.');
              } else {
                const targetKey = itemToRemove?.cartItemId || itemToRemove?.id;
                setCartItems((prev) => prev.filter((item) => (item.cartItemId || item.id) !== targetKey));
                showToast('Removed item from checkout.');
              }
            }}
            onOrderPlaced={() => {
              if (buyNowItem) {
                setBuyNowItem(null);
                try {
                  sessionStorage.removeItem('aura_buy_now_item');
                } catch (e) {}
              } else {
                setCartItems([]);
                try {
                  localStorage.removeItem('aura_cart_items');
                } catch (e) {}
              }
              setAppliedCoupon(null);
              try {
                localStorage.removeItem('aura_applied_coupon');
              } catch (e) {}
              showToast('Order confirmed! ✨');
              fetchProducts();
            }}
          />
        </main>
      ) : currentView === 'wishlist' ? (
        <main>
          <WishlistPage 
            wishlistProducts={wishlistProducts}
            allProducts={products}
            onAddToCart={handleAddToCart}
            onRemoveFromWishlist={handleRemoveFromWishlist}
            onSelectProduct={handleSelectProduct}
            onNavigate={handleNavigate}
            currentUser={currentUser}
          />
        </main>
      ) : currentView === 'cart' ? (
        <main>
          <CartPage 
            cartItems={cartItems}
            products={products}
            appliedCoupon={appliedCoupon}
            onApplyCoupon={setAppliedCoupon}
            onRemoveCoupon={() => setAppliedCoupon(null)}
            currentUser={currentUser}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveFromCart}
            onMoveToWishlist={handleMoveToWishlist}
            onNavigate={handleNavigate}
            onProductClick={handleSelectProduct}
            onCheckout={handleCheckout}
          />
        </main>
      ) : currentView === 'track' ? (
        <main>
          <TrackOrderPage currentUser={currentUser} onNavigate={handleNavigate} />
        </main>
      ) : currentView === 'care' ? (
        <main>
          <CustomerCarePage initialTab={careTab} onNavigate={handleNavigate} />
        </main>
      ) : currentView === 'product' ? (
        <main>
          <ProductDetails 
            product={selectedProduct || products[0]}
            allProducts={products}
            currentUser={currentUser}
            onAddToCart={handleAddToCart}
            onBuyNow={handleBuyNow}
            onToggleWishlist={handleToggleWishlist}
            wishlistItems={wishlistItems}
            onNavigate={handleNavigate}
            onSelectProduct={handleSelectProduct}
            showToast={showToast}
          />
        </main>
      ) : currentView === 'shop' ? (
        <main>
          <ShopPage 
            products={products}
            loading={productsLoading}
            error={productsError}
            onRetry={fetchProducts}
            category={shopCategory}
            initialCategory={shopCategory}
            searchQuery={shopSearch}
            initialSearch={shopSearch}
            sortBy={shopSort}
            initialSort={shopSort}
            onFilterChange={handleShopFilterChange}
            onAddToCart={handleAddToCart}
            onToggleWishlist={handleToggleWishlist}
            wishlistItems={wishlistItems}
            onNavigateHome={() => handleNavigate('home')}
            onProductClick={handleSelectProduct}
          />
        </main>
      ) : (
        /* Unchanged AURA Homepage */
        <main>
          {/* 2. Hero Section */}
          <Hero 
            onShopNowClick={() => handleNavigate('shop', 'All')} 
          />

          {/* 3. Trust Badges / Value Proposition */}
          <TrustBadges />

          {/* 4. Shop by Category Section */}
          <Categories 
            onSelectCategory={handleSelectCategory}
          />

          {/* 5. Featured Products / Our Bestsellers */}
          <Bestsellers 
            products={products}
            loading={productsLoading}
            onAddToCart={handleAddToCart}
            onToggleWishlist={handleToggleWishlist}
            wishlistItems={wishlistItems}
            onViewProductsClick={() => handleNavigate('shop', 'All')}
            onProductClick={handleSelectProduct}
          />

          {/* 6. Promotional / New Arrivals CTA Section */}
          <PromoBanner 
            onExploreClick={() => {
              handleNavigate('shop', 'All');
              showToast('Exploring the New 2026 Collection ✨');
            }}
          />
        </main>
      )}

      {/* 7. Footer */}
      <Footer 
        onSubscribe={(email) => showToast(`Subscribed ${email} to AURA newsletter!`)}
        onNavigate={handleNavigate}
      />

      {/* Floating Interactive Toast */}
      {toastMessage && (
        <div className="aura-toast" role="alert">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default App;