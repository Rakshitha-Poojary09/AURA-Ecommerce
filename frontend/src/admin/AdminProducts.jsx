import React, { useState, useEffect } from 'react';
import './AdminProducts.css';
import { API_BASE } from '../utils/apiConfig';

// Backend Express API endpoint for products
const API_URL = `${API_BASE}/api/products`;

// Available clothing sizes for selection
const AVAILABLE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

// Available categories for clothing store
const CATEGORIES = ['Women', 'Men', 'Kids', 'Accessories'];

// Sample image URL for easy testing
const SAMPLE_IMAGE_URL = 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=700&q=80';

export default function AdminProducts({ initialOpenForm = false }) {
  // Form visibility state
  const [showAddForm, setShowAddForm] = useState(initialOpenForm);

  // Loading state while saving a product to the backend API
  const [isSaving, setIsSaving] = useState(false);

  // Loading state while deleting a product from backend
  const [deletingId, setDeletingId] = useState(null);

  // Catalog products state (loaded directly from MongoDB backend as single source of truth)
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit mode state: holds the product being edited or null for new product
  const [editingProduct, setEditingProduct] = useState(null);

  // Form input fields state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image: '',
    sizes: [],
    stock: '',
  });

  // Validation errors state
  const [errors, setErrors] = useState({});

  // UI feedback message (for Add Product form)
  const [submitFeedback, setSubmitFeedback] = useState(null);

  // UI feedback message (for Catalog table actions like deletion)
  const [catalogFeedback, setCatalogFeedback] = useState(null);

  // Search & Filter state for catalog list
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilterCategory, setSelectedFilterCategory] = useState('All');

  // ------------------------------------------------------------------------
  // API: Fetch All Products from Express / MongoDB Backend
  // Communicates via HTTP GET to http://localhost:5000/api/products
  // ------------------------------------------------------------------------
  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      // Send GET request to Express route: app.get("/api/products")
      const response = await fetch(API_URL);

      if (response.ok) {
        // Parse the JSON array returned from MongoDB (Product.find())
        const dbProducts = await response.json();

        if (Array.isArray(dbProducts)) {
          // Normalize MongoDB _id to id for React keys
          const formattedDb = dbProducts.map((item) => ({
            ...item,
            id: item._id || item.id,
          }));

          // MongoDB products as the single source of truth for the catalog
          setProducts(formattedDb);
        }
      } else {
        setCatalogFeedback({
          type: 'error',
          text: 'Failed to load products from database.',
        });
      }
    } catch (err) {
      console.error('Could not fetch products from backend:', err);
      setCatalogFeedback({
        type: 'error',
        text: 'Could not connect to backend to load products. Please make sure the server is running.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load products from Express backend on initial page load
  useEffect(() => {
    fetchProducts();
  }, []);

  // ------------------------------------------------------------------------
  // API: Delete Product from Express / MongoDB Backend
  // Communicates via HTTP DELETE to http://localhost:5000/api/products/:id
  // ------------------------------------------------------------------------
  const handleDeleteProduct = async (product) => {
    // 1. Guard check: only delete products that actually exist in MongoDB
    if (!product._id) {
      alert('Mock demo products cannot be deleted from the database. Only MongoDB-saved products can be deleted.');
      return;
    }

    // 2. Simple confirmation prompt
    const confirmDelete = window.confirm('Are you sure you want to delete this product?');
    if (!confirmDelete) return;

    setDeletingId(product._id);
    setCatalogFeedback(null);

    try {
      // 3. Send DELETE request to Express backend using product._id
      const response = await fetch(`${API_URL}/${product._id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        // 4. Show success message
        setCatalogFeedback({
          type: 'success',
          text: 'Product deleted successfully.',
        });

        // 5. Refresh the product list from MongoDB so the deleted product disappears immediately
        await fetchProducts();
      } else {
        // 6. Handle backend error
        setCatalogFeedback({
          type: 'error',
          text: data.message || 'Error deleting product from database.',
        });
      }
    } catch (error) {
      console.error('Error deleting product from backend:', error);
      setCatalogFeedback({
        type: 'error',
        text: 'Could not connect to the backend server to delete the product.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Handle standard text / select / number input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear field-specific error as user types
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  // Handle size pill toggle (multi-select)
  const handleSizeToggle = (size) => {
    setFormData((prev) => {
      const exists = prev.sizes.includes(size);
      const updatedSizes = exists
        ? prev.sizes.filter((s) => s !== size)
        : [...prev.sizes, size];
      return {
        ...prev,
        sizes: updatedSizes,
      };
    });

    if (errors.sizes) {
      setErrors((prev) => ({
        ...prev,
        sizes: '',
      }));
    }
  };

  // Quick helper to select all sizes
  const handleSelectAllSizes = () => {
    setFormData((prev) => ({ ...prev, sizes: [...AVAILABLE_SIZES] }));
    if (errors.sizes) {
      setErrors((prev) => ({ ...prev, sizes: '' }));
    }
  };

  // Quick helper to clear sizes
  const handleClearSizes = () => {
    setFormData((prev) => ({ ...prev, sizes: [] }));
  };

  // Quick helper to paste sample image URL for testing
  const handleUseSampleImage = () => {
    setFormData((prev) => ({ ...prev, image: SAMPLE_IMAGE_URL }));
    if (errors.image) {
      setErrors((prev) => ({ ...prev, image: '' }));
    }
  };

  // Form validation function
  const validateForm = () => {
    const newErrors = {};

    // 1. Product Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Product name must be at least 3 characters long';
    }

    // 2. Category validation
    if (!formData.category) {
      newErrors.category = 'Please select a product category';
    }

    // 3. Price validation
    if (!formData.price) {
      newErrors.price = 'Price is required';
    } else if (isNaN(formData.price) || Number(formData.price) <= 0) {
      newErrors.price = 'Please enter a valid price greater than ₹0';
    }

    // 4. Stock validation
    if (formData.stock === '') {
      newErrors.stock = 'Stock quantity is required';
    } else if (isNaN(formData.stock) || Number(formData.stock) < 0) {
      newErrors.stock = 'Stock quantity must be 0 or a positive number';
    }

    // 5. Description validation
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters long';
    }

    // 6. Image validation (accepts external URLs or local /products/ paths)
    if (!formData.image.trim()) {
      newErrors.image = 'Image is required';
    } else {
      const trimmedImage = formData.image.trim();
      const isExternalUrl = /^https?:\/\/.+/i.test(trimmedImage);
      const isLocalPath = trimmedImage.startsWith('/products/');

      if (!isExternalUrl && !isLocalPath) {
        newErrors.image = 'Use an image URL or a local path like /products/shirt.jpg';
      }
    }

    // 7. Available Sizes validation
    if (!formData.sizes || formData.sizes.length === 0) {
      newErrors.sizes = 'Please select at least one available size';
    }

    return newErrors;
  };

  // ------------------------------------------------------------------------
  // API: Save or Update Product in Express / MongoDB Backend
  // - If editingProduct is set: HTTP PUT to http://localhost:5000/api/products/:id
  // - Otherwise: HTTP POST to http://localhost:5000/api/products
  // ------------------------------------------------------------------------
  const handleSaveProduct = async (e) => {
    e.preventDefault();

    // 1. Client-side form validation before making the network request
    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setSubmitFeedback({
        type: 'error',
        text: 'Please correct the highlighted fields before saving.',
      });
      return;
    }

    // 2. Map form data to MongoDB Product schema fields:
    const productPayload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      price: Number(formData.price),
      category: formData.category,
      image: formData.image.trim(),
      sizes: formData.sizes,
      stock: Number(formData.stock),
    };

    // 3. Set loading state
    setIsSaving(true);
    setSubmitFeedback(null);

    const isEditing = Boolean(editingProduct);
    const targetUrl = isEditing 
      ? `${API_URL}/${editingProduct._id || editingProduct.id}`
      : API_URL;
    const httpMethod = isEditing ? 'PUT' : 'POST';

    try {
      // 4. Send HTTP PUT or POST request with JSON payload to Express backend
      const response = await fetch(targetUrl, {
        method: httpMethod,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productPayload),
      });

      // 5. Parse JSON response returned from Express
      const result = await response.json();

      if (response.ok) {
        // SUCCESS: Status 200 (Update) or 201 (Created)
        setErrors({});
        setSubmitFeedback({
          type: 'success',
          text: isEditing 
            ? 'Product updated successfully!' 
            : 'Product added successfully!',
        });

        // Clear and reset the form inputs
        setFormData({
          name: '',
          description: '',
          price: '',
          category: '',
          image: '',
          sizes: [],
          stock: '',
        });
        setEditingProduct(null);

        // Refresh the Products catalog from MongoDB so changes appear immediately
        await fetchProducts();
      } else {
        // ERROR: Status 400/500 from backend
        const errorMsg = result.message
          ? `${result.message}${result.error ? `: ${result.error}` : ''}`
          : isEditing ? 'Failed to update product. Please check your inputs.' : 'Failed to add product. Please check your inputs.';

        setSubmitFeedback({
          type: 'error',
          text: errorMsg,
        });
      }
    } catch (networkError) {
      console.error('API connection error:', networkError);
      setSubmitFeedback({
        type: 'error',
        text: `Could not connect to the backend server at ${API_BASE}. Please ensure your Express backend is running.`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Edit action: populate form with selected product and enter edit mode
  const handleEditClick = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      description: product.description || '',
      price: product.price !== undefined ? product.price.toString() : '',
      category: product.category || '',
      image: product.image || '',
      sizes: Array.isArray(product.sizes) ? product.sizes : [],
      stock: product.stock !== undefined ? product.stock.toString() : '0',
    });
    setErrors({});
    setSubmitFeedback(null);
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle Cancel action: reset form and errors, exit edit mode, and hide form
  const handleCancel = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      category: '',
      image: '',
      sizes: [],
      stock: '',
    });
    setEditingProduct(null);
    setErrors({});
    setSubmitFeedback(null);
    setShowAddForm(false);
  };

  // Filter catalog products for display (uses live products state from MongoDB + mock data)
  const filteredProducts = products.filter((prod) => {
    const matchesSearch = prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          prod.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedFilterCategory === 'All' || prod.category === selectedFilterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="admin-products-page">
      
      {/* 1. Page Header & Actions */}
      <div className="products-page-header">
        <div>
          <div className="breadcrumb-nav">
            <span className="breadcrumb-item">Admin</span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Products</span>
          </div>
          <h1 className="products-main-title">Products Management</h1>
          <p className="products-main-subtitle">
            Manage your boutique clothing catalog, view inventory, and add new luxury items.
          </p>
        </div>

        <button 
          className={`btn-primary add-product-toggle-btn ${showAddForm ? 'active' : ''}`}
          onClick={() => {
            if (showAddForm) {
              handleCancel();
            } else {
              setShowAddForm(true);
              setSubmitFeedback(null);
            }
          }}
          aria-expanded={showAddForm}
        >
          {showAddForm ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              <span>{editingProduct ? 'Cancel Edit' : 'Hide Form'}</span>
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Add New Product</span>
            </>
          )}
        </button>
      </div>

      {/* 2. Add Product Form Section (Collapsible / Toggleable) */}
      {showAddForm && (
        <section className="add-product-form-card" aria-labelledby="add-product-title">
          
          <div className="form-card-header">
            <div className="form-card-title-group">
              <span className="form-card-badge">{editingProduct ? 'Edit Mode' : 'Catalog Form'}</span>
              <h2 id="add-product-title" className="form-card-title">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <p className="form-card-subtitle">
                {editingProduct
                  ? 'Update the product information below. All fields marked with an asterisk (*) are mandatory.'
                  : 'Enter the product information below. All fields marked with an asterisk (*) are mandatory.'}
              </p>
            </div>
            
            <button 
              type="button" 
              className="form-close-btn"
              onClick={handleCancel}
              title="Close form"
              aria-label="Close form"
            >
              ✕
            </button>
          </div>

          {/* Form Feedback Alert (Success / Error) */}
          {submitFeedback && (
            <div className={`form-feedback-alert ${submitFeedback.type}`} role="alert">
              <div className="feedback-icon">
                {submitFeedback.type === 'success' ? '✓' : '⚠️'}
              </div>
              <div className="feedback-content">
                <strong>{submitFeedback.type === 'success' ? 'Validation Passed' : 'Validation Error'}</strong>
                <p>{submitFeedback.text}</p>
              </div>
              <button 
                type="button" 
                className="feedback-dismiss-btn"
                onClick={() => setSubmitFeedback(null)}
                aria-label="Dismiss message"
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handleSaveProduct} noValidate className="product-form">
            
            <div className="form-grid">
              
              {/* Left Column: Core Details */}
              <div className="form-column">
                
                {/* Product Name */}
                <div className={`form-group ${errors.name ? 'has-error' : ''}`}>
                  <label htmlFor="product-name" className="form-label">
                    Product Name <span className="required-star">*</span>
                  </label>
                  <input
                    id="product-name"
                    name="name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Silk Linen Relaxed Shirt"
                    value={formData.name}
                    onChange={handleInputChange}
                  />
                  {errors.name && <span className="field-error-message">{errors.name}</span>}
                </div>

                {/* Category & Price in 2 Columns */}
                <div className="form-subgrid">
                  {/* Category */}
                  <div className={`form-group ${errors.category ? 'has-error' : ''}`}>
                    <label htmlFor="product-category" className="form-label">
                      Category <span className="required-star">*</span>
                    </label>
                    <select
                      id="product-category"
                      name="category"
                      className="form-select"
                      value={formData.category}
                      onChange={handleInputChange}
                    >
                      <option value="">Select a Category</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    {errors.category && <span className="field-error-message">{errors.category}</span>}
                  </div>

                  {/* Price */}
                  <div className={`form-group ${errors.price ? 'has-error' : ''}`}>
                    <label htmlFor="product-price" className="form-label">
                      Price (₹) <span className="required-star">*</span>
                    </label>
                    <div className="input-with-prefix">
                      <span className="input-currency-prefix">₹</span>
                      <input
                        id="product-price"
                        name="price"
                        type="number"
                        min="1"
                        step="1"
                        className="form-input has-prefix"
                        placeholder="1499"
                        value={formData.price}
                        onChange={handleInputChange}
                      />
                    </div>
                    {errors.price && <span className="field-error-message">{errors.price}</span>}
                  </div>
                </div>

                {/* Stock Quantity */}
                <div className={`form-group ${errors.stock ? 'has-error' : ''}`}>
                  <label htmlFor="product-stock" className="form-label">
                    Stock Quantity <span className="required-star">*</span>
                  </label>
                  <input
                    id="product-stock"
                    name="stock"
                    type="number"
                    min="0"
                    step="1"
                    className="form-input"
                    placeholder="e.g. 50"
                    value={formData.stock}
                    onChange={handleInputChange}
                  />
                  <span className="field-hint">Initial inventory units available for sale.</span>
                  {errors.stock && <span className="field-error-message">{errors.stock}</span>}
                </div>

                {/* Description */}
                <div className={`form-group ${errors.description ? 'has-error' : ''}`}>
                  <label htmlFor="product-description" className="form-label">
                    Description <span className="required-star">*</span>
                  </label>
                  <textarea
                    id="product-description"
                    name="description"
                    rows="4"
                    className="form-textarea"
                    placeholder="Provide a detailed description of the garment, material, weave, fit, and styling recommendations..."
                    value={formData.description}
                    onChange={handleInputChange}
                  />
                  <div className="field-meta-row">
                    <span className="field-hint">Describe fabric texture, fit, and care instructions.</span>
                    <span className="char-count">{formData.description.length} chars</span>
                  </div>
                  {errors.description && <span className="field-error-message">{errors.description}</span>}
                </div>

              </div>

              {/* Right Column: Image URL & Size Picker */}
              <div className="form-column">
                
                {/* Image URL with live preview */}
                <div className={`form-group ${errors.image ? 'has-error' : ''}`}>
                  <div className="label-with-action">
                    <label htmlFor="product-image" className="form-label">
                      Image URL <span className="required-star">*</span>
                    </label>
                    <button 
                      type="button" 
                      className="text-action-link"
                      onClick={handleUseSampleImage}
                      title="Insert a high-quality fashion sample image"
                    >
                      ✨ Use Sample Image
                    </button>
                  </div>
                  <input
                    id="product-image"
                    name="image"
                    type="text"
                    className="form-input"
                    placeholder="https://... or /products/shirt.jpg"
                    value={formData.image}
                    onChange={handleInputChange}
                  />
                  {errors.image && <span className="field-error-message">{errors.image}</span>}

                  {/* Live Image Preview Card */}
                  <div className="image-preview-container">
                    <span className="preview-label">Image Preview:</span>
                    {formData.image.trim() ? (
                      <div className="image-preview-wrapper">
                        <img 
                          key={formData.image}
                          src={formData.image} 
                          alt="Product preview" 
                          className="preview-img"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            if (e.target.nextSibling) {
                              e.target.nextSibling.style.display = 'flex';
                            }
                          }}
                        />
                        <div className="preview-fallback" style={{ display: 'none' }}>
                          <span>⚠️ Could not load image from this path or URL</span>
                        </div>
                      </div>
                    ) : (
                      <div className="preview-empty-state">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                        <span>Paste an image URL or local path (/products/...) to preview</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Available Sizes Selection */}
                <div className={`form-group ${errors.sizes ? 'has-error' : ''}`}>
                  <div className="label-with-action">
                    <label className="form-label">
                      Available Sizes <span className="required-star">*</span>
                    </label>
                    <div className="size-quick-actions">
                      <button 
                        type="button" 
                        className="text-action-link"
                        onClick={handleSelectAllSizes}
                      >
                        Select All
                      </button>
                      <span className="action-divider">|</span>
                      <button 
                        type="button" 
                        className="text-action-link"
                        onClick={handleClearSizes}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="sizes-pill-grid">
                    {AVAILABLE_SIZES.map((size) => {
                      const isSelected = formData.sizes.includes(size);
                      return (
                        <button
                          key={size}
                          type="button"
                          className={`size-toggle-pill ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSizeToggle(size)}
                          aria-pressed={isSelected}
                        >
                          <span className="size-label">{size}</span>
                          {isSelected && <span className="size-check-icon">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                  <span className="field-hint">Click the sizes to toggle them on or off.</span>
                  {errors.sizes && <span className="field-error-message">{errors.sizes}</span>}
                </div>

              </div>

            </div>

            {/* 4. Form Action Buttons (Save & Cancel) */}
            <div className="form-actions-footer">
              <button 
                type="button" 
                className="btn-secondary form-cancel-btn"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-primary form-submit-btn"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <svg className="spinner-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12"></circle>
                    </svg>
                    <span>{editingProduct ? 'Updating...' : 'Saving...'}</span>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                      <polyline points="17 21 17 13 7 13 7 21"></polyline>
                      <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    <span>{editingProduct ? 'Update Product' : 'Save Product'}</span>
                  </>
                )}
              </button>
            </div>

          </form>

        </section>
      )}

      {/* 3. Existing Products Catalog Table & Quick Stats */}
      <section className="catalog-section">
        
        {/* Catalog Feedback Alert (for deletion or catalog actions) */}
        {catalogFeedback && (
          <div className={`catalog-feedback-alert ${catalogFeedback.type}`} role="alert">
            <span className="catalog-feedback-icon">
              {catalogFeedback.type === 'success' ? '✓' : '⚠️'}
            </span>
            <p>{catalogFeedback.text}</p>
            <button 
              type="button" 
              className="feedback-dismiss-btn"
              onClick={() => setCatalogFeedback(null)}
              aria-label="Dismiss message"
            >
              ✕
            </button>
          </div>
        )}

        {/* Catalog Control Bar */}
        <div className="catalog-toolbar">
          
          <div className="toolbar-left">
            <h2 className="catalog-heading">Current Catalog</h2>
            <span className="catalog-counter-pill">{filteredProducts.length} Products</span>
            <button 
              type="button" 
              className="btn-secondary"
              onClick={fetchProducts}
              disabled={isLoading}
              title="Refresh catalog from MongoDB"
              style={{ marginLeft: '12px', padding: '6px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isLoading ? 'spinning' : ''}>
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              Refresh
            </button>
          </div>

          <div className="toolbar-right">
            
            {/* Category Filter Pills */}
            <div className="category-filter-group">
              {['All', ...CATEGORIES].map((category) => (
                <button
                  key={category}
                  className={`category-filter-btn ${selectedFilterCategory === category ? 'active' : ''}`}
                  onClick={() => setSelectedFilterCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Catalog Search Input */}
            <div className="catalog-search-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="catalog-search-input"
              />
              {searchTerm && (
                <button 
                  type="button" 
                  className="clear-search-btn"
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

          </div>

        </div>

        {/* Catalog Table */}
        <div className="catalog-table-container">
          <table className="catalog-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Sizes Available</th>
                <th>Stock Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length > 0 ? (
                filteredProducts.map((prod, index) => {
                  // Real stock number from MongoDB product
                  const stockCount = typeof prod.stock === 'number' ? prod.stock : 20;
                  const isLow = stockCount <= 5;
                  const itemSizes = Array.isArray(prod.sizes) && prod.sizes.length > 0 ? prod.sizes : ['S', 'M', 'L'];
                  const skuCode = prod._id 
                    ? `AUR-${prod._id.slice(-4).toUpperCase()}` 
                    : `AUR-${1000 + (prod.id || index)}`;

                  return (
                    <tr key={prod._id || prod.id || index}>
                      {/* Product Name & Thumbnail */}
                      <td className="product-info-cell">
                        <img 
                          src={prod.image} 
                          alt={prod.name} 
                          className="product-table-thumb" 
                        />
                        <div className="product-meta">
                          <span className="product-table-name">{prod.name}</span>
                          <span className="product-table-sub">SKU: {skuCode}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td>
                        <span className="category-pill">{prod.category}</span>
                      </td>

                      {/* Price */}
                      <td className="product-price-cell">
                        <strong>₹{Number(prod.price).toLocaleString('en-IN')}</strong>
                        {prod.originalPrice && (
                          <span className="product-table-original-price">
                            ₹{Number(prod.originalPrice).toLocaleString('en-IN')}
                          </span>
                        )}
                      </td>

                      {/* Sizes */}
                      <td>
                        <div className="table-sizes-row">
                          {itemSizes.map((s) => (
                            <span key={s} className="table-size-badge">{s}</span>
                          ))}
                        </div>
                      </td>

                      {/* Stock Status */}
                      <td>
                        <div className="stock-status-cell">
                          <span className={`stock-badge ${isLow ? 'low-stock' : 'in-stock'}`}>
                            {isLow ? `Low Stock (${stockCount})` : `In Stock (${stockCount})`}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td>
                        <div className="table-actions-group">
                          <button 
                            className="table-action-btn"
                            onClick={() => handleEditClick(prod)}
                            title="Edit product details"
                          >
                            Edit
                          </button>
                          <button 
                            className="table-action-btn delete-btn"
                            onClick={() => handleDeleteProduct(prod)}
                            disabled={deletingId === prod._id}
                            title={prod._id ? "Delete product from MongoDB" : "Mock demo product (cannot be deleted)"}
                          >
                            {deletingId === prod._id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="empty-catalog-cell">
                    <div className="empty-catalog-box">
                      <p>No products found matching "{searchTerm}".</p>
                      <button 
                        type="button" 
                        className="btn-secondary btn-sm"
                        onClick={() => {
                          setSearchTerm('');
                          setSelectedFilterCategory('All');
                        }}
                      >
                        Reset Filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </section>

    </div>
  );
}
