import React, { useState, useEffect } from 'react';
import './AdminProducts.css';
import { adminFetch, API_BASE } from '../utils/apiClient';
import { normalizeProductImageUrl, handleImageError, NEUTRAL_PLACEHOLDER_IMAGE } from '../utils/imageUtils';

// Available clothing sizes for selection
const AVAILABLE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

// Available categories for clothing store
const CATEGORIES = ['Women', 'Men', 'Kids', 'Accessories'];

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
    mrp: '',
    category: '',
    image: '',
    sizes: [],
    sizeStock: {},
    stock: '',
    colorVariants: [],
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
  // ------------------------------------------------------------------------
  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const response = await adminFetch('/api/products');

      if (response.ok) {
        const dbProducts = await response.json();

        if (Array.isArray(dbProducts)) {
          const formattedDb = dbProducts.map((item) => ({
            ...item,
            id: item._id || item.id,
          }));

          setProducts(formattedDb);
        }
      } else {
        setCatalogFeedback({
          type: 'error',
          text: 'Failed to retrieve products from backend.',
        });
      }
    } catch (error) {
      console.error('Error fetching products from MongoDB:', error);
      setCatalogFeedback({
        type: 'error',
        text: `Could not connect to backend server at ${API_BASE}.`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // ------------------------------------------------------------------------
  // API: Delete Product from Express / MongoDB Backend
  // Protected with requireAdmin on backend
  // ------------------------------------------------------------------------
  const handleDeleteProduct = async (product) => {
    if (!product._id) {
      alert('Cannot delete product without a valid database record.');
      return;
    }

    const confirmDelete = window.confirm(`Are you sure you want to delete "${product.name}"?`);
    if (!confirmDelete) return;

    setDeletingId(product._id);
    setCatalogFeedback(null);

    try {
      const response = await adminFetch(`/api/products/${product._id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        setCatalogFeedback({
          type: 'success',
          text: `Product "${product.name}" deleted successfully from catalog.`,
        });
        await fetchProducts();
      } else {
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === 'category') {
      if (value === 'Accessories') {
        setFormData((prev) => {
          const currentTotal = Object.values(prev.sizeStock || {}).reduce(
            (sum, v) => sum + (Number(v) || 0),
            0
          ) || Number(prev.stock) || 10;

          return {
            ...prev,
            category: value,
            sizes: ['One Size'],
            sizeStock: { 'One Size': currentTotal },
            stock: currentTotal.toString(),
          };
        });

        setErrors((prev) => ({
          ...prev,
          category: '',
          sizes: '',
        }));
        return;
      } else if (formData.category === 'Accessories') {
        // Switching away from Accessories to a clothing category (Women, Men, Kids)
        setFormData((prev) => {
          const defaultClothingSizes = ['S', 'M', 'L'];
          const defaultSizeStock = { S: 5, M: 5, L: 5 };
          return {
            ...prev,
            category: value,
            sizes: defaultClothingSizes,
            sizeStock: defaultSizeStock,
            stock: '15',
          };
        });

        setErrors((prev) => ({
          ...prev,
          category: '',
        }));
        return;
      }
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSizeToggle = (size) => {
    if (formData.category === 'Accessories') return; // Accessories are fixed to 'One Size'

    setFormData((prev) => {
      const exists = prev.sizes.includes(size);
      const updatedSizes = exists
        ? prev.sizes.filter((s) => s !== size)
        : [...prev.sizes, size];

      const updatedSizeStock = { ...(prev.sizeStock || {}) };
      if (!exists) {
        if (updatedSizeStock[size] === undefined) {
          updatedSizeStock[size] = 5;
        }
      } else {
        delete updatedSizeStock[size];
      }

      const totalStock = Object.values(updatedSizeStock).reduce(
        (sum, v) => sum + (Number(v) || 0),
        0
      );

      return {
        ...prev,
        sizes: updatedSizes,
        sizeStock: updatedSizeStock,
        stock: totalStock.toString(),
      };
    });

    if (errors.sizes) {
      setErrors((prev) => ({
        ...prev,
        sizes: '',
      }));
    }
  };

  const handleSelectAllSizes = () => {
    if (formData.category === 'Accessories') return;

    setFormData((prev) => {
      const updatedSizeStock = { ...(prev.sizeStock || {}) };
      AVAILABLE_SIZES.forEach((sz) => {
        if (updatedSizeStock[sz] === undefined) {
          updatedSizeStock[sz] = 5;
        }
      });
      const totalStock = Object.values(updatedSizeStock).reduce(
        (sum, v) => sum + (Number(v) || 0),
        0
      );
      return {
        ...prev,
        sizes: [...AVAILABLE_SIZES],
        sizeStock: updatedSizeStock,
        stock: totalStock.toString(),
      };
    });
    if (errors.sizes) {
      setErrors((prev) => ({ ...prev, sizes: '' }));
    }
  };

  const handleClearSizes = () => {
    if (formData.category === 'Accessories') return;

    setFormData((prev) => ({
      ...prev,
      sizes: [],
      sizeStock: {},
      stock: '0',
    }));
  };

  const handleSizeStockChange = (size, val) => {
    setFormData((prev) => {
      const parsedVal = val === '' ? '' : Math.max(0, parseInt(val, 10) || 0);
      const updatedSizeStock = {
        ...(prev.sizeStock || {}),
        [size]: parsedVal,
      };
      const totalStock = Object.values(updatedSizeStock).reduce(
        (sum, v) => sum + (Number(v) || 0),
        0
      );
      return {
        ...prev,
        sizeStock: updatedSizeStock,
        stock: totalStock.toString(),
      };
    });

    if (errors.stock) {
      setErrors((prev) => ({ ...prev, stock: '' }));
    }
  };

  const getSizeStockStatus = (qty) => {
    const num = Number(qty) || 0;
    if (num === 0) return { label: 'Out of Stock', cls: 'status-out' };
    if (num <= 5) return { label: 'Low Stock', cls: 'status-low' };
    return { label: 'Available', cls: 'status-available' };
  };

  const handleImageFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, image: 'Please select a valid image file (JPG, PNG, WEBP, etc.)' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (result) {
        setFormData((prev) => ({ ...prev, image: result }));
        if (errors.image) {
          setErrors((prev) => ({ ...prev, image: '' }));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Colour Variant Handlers for Accessories
  const handleAddColorVariant = () => {
    setFormData((prev) => ({
      ...prev,
      colorVariants: [
        ...(prev.colorVariants || []),
        {
          colorName: '',
          colorCode: '#1c1c1c',
          image: '',
          stock: 10,
        },
      ],
    }));
  };

  const handleUpdateColorVariant = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...(prev.colorVariants || [])];
      updated[index] = {
        ...updated[index],
        [field]: field === 'stock' ? Math.max(0, parseInt(value, 10) || 0) : value,
      };
      return {
        ...prev,
        colorVariants: updated,
      };
    });
  };

  const handleVariantImageFileUpload = (index, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WebP, etc.)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image file size exceeds 10MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const base64Data = loadEvent.target?.result;
      if (typeof base64Data === 'string') {
        handleUpdateColorVariant(index, 'image', base64Data);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveColorVariant = (index) => {
    setFormData((prev) => {
      const updated = (prev.colorVariants || []).filter((_, i) => i !== index);
      return {
        ...prev,
        colorVariants: updated,
      };
    });
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Product name must be at least 3 characters long';
    }

    if (!formData.category) {
      newErrors.category = 'Please select a product category';
    }

    if (!formData.price) {
      newErrors.price = 'Selling price is required';
    } else if (isNaN(formData.price) || Number(formData.price) <= 0) {
      newErrors.price = 'Please enter a valid selling price greater than ₹0';
    }

    if (formData.mrp !== '' && formData.mrp !== null && formData.mrp !== undefined) {
      if (isNaN(formData.mrp) || Number(formData.mrp) <= 0) {
        newErrors.mrp = 'Please enter a valid MRP greater than ₹0';
      } else if (Number(formData.price) > 0 && Number(formData.mrp) < Number(formData.price)) {
        newErrors.mrp = 'MRP cannot be less than selling price';
      }
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters long';
    }

    if (!formData.image.trim()) {
      newErrors.image = 'Image is required';
    } else {
      const trimmedImage = formData.image.trim();
      const isExternalUrl = /^https?:\/\/.+/i.test(trimmedImage);
      const isDataUri = trimmedImage.startsWith('data:image/');
      const isLocalPath = trimmedImage.startsWith('/products/') || trimmedImage.startsWith('products/') || trimmedImage.startsWith('/');

      if (!isExternalUrl && !isLocalPath && !isDataUri) {
        newErrors.image = 'Use an image URL (https://...), local path (/products/...) or upload a file';
      }
    }

    if (formData.category === 'Accessories') {
      if (!formData.sizes || !formData.sizes.includes('One Size')) {
        formData.sizes = ['One Size'];
      }
      const oneSizeVal = formData.sizeStock?.['One Size'];
      if (oneSizeVal === '' || oneSizeVal === undefined || isNaN(oneSizeVal) || Number(oneSizeVal) < 0) {
        newErrors.stock = 'Please enter a valid stock quantity for One Size';
      }
    } else {
      if (!formData.sizes || formData.sizes.length === 0) {
        newErrors.sizes = 'Please select at least one available size';
      } else {
        for (const sz of formData.sizes) {
          const val = formData.sizeStock?.[sz];
          if (val === '' || val === undefined || isNaN(val) || Number(val) < 0) {
            newErrors.stock = `Please enter a valid stock quantity for size ${sz}`;
            break;
          }
        }
      }
    }

    return newErrors;
  };

  // ------------------------------------------------------------------------
  // API: Save or Update Product in Express / MongoDB Backend
  // Protected with requireAdmin on backend
  // ------------------------------------------------------------------------
  const handleSaveProduct = async (e) => {
    e.preventDefault();

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setSubmitFeedback({
        type: 'error',
        text: 'Please resolve the highlighted validation errors before saving.',
      });
      return;
    }

    const cleanedSizeStock = {};
    formData.sizes.forEach((sz) => {
      cleanedSizeStock[sz] = Math.max(0, parseInt(formData.sizeStock?.[sz], 10) || 0);
    });

    let cleanedVariants = [];
    if (formData.category === 'Accessories' && Array.isArray(formData.colorVariants) && formData.colorVariants.length > 0) {
      cleanedVariants = formData.colorVariants
        .filter((v) => v.colorName && v.colorName.trim())
        .map((v) => {
          const vImg = (v.image && v.image.trim()) || formData.image.trim();
          return {
            colorName: v.colorName.trim(),
            colorCode: v.colorCode && v.colorCode.trim() ? v.colorCode.trim() : '#1c1c1c',
            image: vImg,
            images: [vImg].filter(Boolean),
            stock: Math.max(0, parseInt(v.stock, 10) || 0),
          };
        });
    }

    let totalComputedStock = 0;
    if (formData.category === 'Accessories' && cleanedVariants.length > 0) {
      totalComputedStock = cleanedVariants.reduce((sum, v) => sum + v.stock, 0);
    } else {
      totalComputedStock = Object.values(cleanedSizeStock).reduce((sum, v) => sum + v, 0);
    }

    const productPayload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      price: Number(formData.price),
      mrp: formData.mrp !== '' && formData.mrp !== null ? Number(formData.mrp) : null,
      category: formData.category,
      image: (formData.image && formData.image.trim()) || (cleanedVariants[0]?.image || ''),
      sizes: formData.sizes,
      sizeStock: formData.category === 'Accessories' ? { 'One Size': totalComputedStock } : cleanedSizeStock,
      stock: totalComputedStock,
      colorVariants: formData.category === 'Accessories' ? cleanedVariants : [],
      colors: formData.category === 'Accessories' ? cleanedVariants.map((v) => v.colorCode || v.colorName) : [],
    };

    setIsSaving(true);
    setSubmitFeedback(null);

    const isEditing = Boolean(editingProduct);
    const targetEndpoint = isEditing 
      ? `/api/products/${editingProduct._id || editingProduct.id}`
      : '/api/products';
    const httpMethod = isEditing ? 'PUT' : 'POST';

    try {
      const response = await adminFetch(targetEndpoint, {
        method: httpMethod,
        body: JSON.stringify(productPayload),
      });

      let result = {};
      try {
        result = await response.json();
      } catch (jsonErr) {
        result = { message: response.statusText || 'Unexpected server response format' };
      }

      if (response.ok) {
        setErrors({});
        setSubmitFeedback({
          type: 'success',
          text: isEditing 
            ? 'Product updated successfully in MongoDB!' 
            : 'Product added successfully to catalog!',
        });

        setFormData({
          name: '',
          description: '',
          price: '',
          category: '',
          image: '',
          sizes: [],
          sizeStock: {},
          stock: '',
        });
        setEditingProduct(null);

        await fetchProducts();
      } else {
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
        text: `Could not connect to the backend server at ${API_BASE}.`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (product) => {
    setEditingProduct(product);
    const isAccessory = (product.category || '').toLowerCase() === 'accessories';
    let prodSizes;
    let prodSizeStock = product.sizeStock && typeof product.sizeStock === 'object' ? { ...product.sizeStock } : {};

    if (isAccessory) {
      prodSizes = ['One Size'];
      const currentStockTotal = Object.values(prodSizeStock).reduce((sum, v) => sum + (Number(v) || 0), 0) || Number(product.stock) || 0;
      prodSizeStock = {
        'One Size': prodSizeStock['One Size'] !== undefined ? prodSizeStock['One Size'] : currentStockTotal,
      };
    } else {
      prodSizes = Array.isArray(product.sizes) && product.sizes.length > 0
        ? product.sizes.filter((s) => s !== 'One Size')
        : ['S', 'M', 'L'];
      if (prodSizes.length === 0) prodSizes = ['S', 'M', 'L'];

      // Ensure each selected size has a key in sizeStock
      prodSizes.forEach((sz) => {
        if (prodSizeStock[sz] === undefined) {
          prodSizeStock[sz] = Math.max(0, Math.floor((product.stock || 0) / (prodSizes.length || 1)));
        }
      });
    }

    const totalStock = Object.values(prodSizeStock).reduce((sum, v) => sum + (Number(v) || 0), 0);

    const colorVariants = Array.isArray(product.colorVariants)
      ? product.colorVariants.map((cv) => ({
          colorName: cv.colorName || '',
          colorCode: cv.colorCode || '#1c1c1c',
          image: cv.image || '',
          stock: typeof cv.stock === 'number' ? cv.stock : 10,
        }))
      : [];

    setFormData({
      name: product.name || '',
      description: product.description || '',
      price: product.price !== undefined ? product.price.toString() : '',
      mrp: product.mrp !== undefined && product.mrp !== null ? product.mrp.toString() : '',
      category: product.category || '',
      image: product.image || '',
      sizes: prodSizes,
      sizeStock: prodSizeStock,
      stock: (totalStock || product.stock || 0).toString(),
      colorVariants,
    });
    setErrors({});
    setSubmitFeedback(null);
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      mrp: '',
      category: '',
      image: '',
      sizes: [],
      sizeStock: {},
      stock: '',
      colorVariants: [],
    });
    setEditingProduct(null);
    setErrors({});
    setSubmitFeedback(null);
    setShowAddForm(false);
  };

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
            Manage your boutique clothing catalog, inventory levels, and product specifications.
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

      {/* Catalog Table Feedback Banner */}
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

      {/* 2. Add / Edit Product Form */}
      {showAddForm && (
        <section className="add-product-form-card" aria-labelledby="form-title">
          
          <div className="form-card-header">
            <div>
              <span className="form-card-badge">
                {editingProduct ? 'EDITING PRODUCT' : 'NEW COLLECTION ITEM'}
              </span>
              <h2 id="form-title" className="form-card-title">
                {editingProduct ? `Edit "${editingProduct.name}"` : 'Add Product to Catalog'}
              </h2>
              <p className="form-card-subtitle">
                {editingProduct 
                  ? 'Update garment details, adjust inventory stock, or change category.' 
                  : 'Fill in details below to publish a new piece to the customer catalog.'}
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

          {submitFeedback && (
            <div className={`form-feedback-alert ${submitFeedback.type}`} role="alert">
              <span className="feedback-icon">
                {submitFeedback.type === 'success' ? '✓' : '⚠️'}
              </span>
              <div className="feedback-content">
                <strong>{submitFeedback.type === 'success' ? 'Success' : 'Notice'}</strong>
                <p>{submitFeedback.text}</p>
              </div>
              <button 
                type="button" 
                className="feedback-dismiss-btn"
                onClick={() => setSubmitFeedback(null)}
                aria-label="Dismiss alert"
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handleSaveProduct} className="product-form" noValidate>
            
            <div className="form-grid">
              
              {/* Left Column: Essential Product Data */}
              <div className="form-column">
                
                {/* Product Name */}
                <div className={`form-group ${errors.name ? 'has-error' : ''}`}>
                  <label htmlFor="product-name" className="form-label">
                    Product Title <span className="required-star">*</span>
                  </label>
                  <input
                    id="product-name"
                    name="name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. AURA Silk Halter Gown"
                    value={formData.name}
                    onChange={handleInputChange}
                    autoComplete="off"
                  />
                  {errors.name && <span className="field-error-message">{errors.name}</span>}
                </div>

                {/* Category, MRP & Selling Price Subgrid */}
                <div className="form-subgrid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                  
                  {/* Category Selection */}
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
                      <option value="">Select Category</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    {errors.category && <span className="field-error-message">{errors.category}</span>}
                  </div>

                  {/* MRP (Maximum Retail Price) */}
                  <div className={`form-group ${errors.mrp ? 'has-error' : ''}`}>
                    <label htmlFor="product-mrp" className="form-label">
                      MRP (₹) <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>(Optional)</span>
                    </label>
                    <div className="input-with-prefix">
                      <span className="input-currency-prefix">₹</span>
                      <input
                        id="product-mrp"
                        name="mrp"
                        type="number"
                        min="1"
                        step="1"
                        className="form-input has-prefix"
                        placeholder="e.g. 1500"
                        value={formData.mrp}
                        onChange={handleInputChange}
                      />
                    </div>
                    {errors.mrp && <span className="field-error-message">{errors.mrp}</span>}
                  </div>

                  {/* Selling Price */}
                  <div className={`form-group ${errors.price ? 'has-error' : ''}`}>
                    <label htmlFor="product-price" className="form-label">
                      Selling Price (₹) <span className="required-star">*</span>
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
                        placeholder="e.g. 1200"
                        value={formData.price}
                        onChange={handleInputChange}
                      />
                    </div>
                    {errors.price && <span className="field-error-message">{errors.price}</span>}
                  </div>

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
                    placeholder="Provide a detailed description of the garment, material, weave, fit..."
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
                
                {/* Image URL / Upload with live preview */}
                <div className={`form-group ${errors.image ? 'has-error' : ''}`}>
                  <div className="label-with-action">
                    <label htmlFor="product-image" className="form-label">
                      Product Image <span className="required-star">*</span>
                    </label>
                    <label htmlFor="admin-image-file-input" className="text-action-link" style={{ cursor: 'pointer' }}>
                      📁 Browse / Upload File
                    </label>
                    <input
                      id="admin-image-file-input"
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleImageFileUpload}
                    />
                  </div>
                  <input
                    id="product-image"
                    name="image"
                    type="text"
                    className="form-input"
                    placeholder="https://... or /products/shirt.jpg or upload file"
                    value={formData.image}
                    onChange={handleInputChange}
                  />
                  {editingProduct && (
                    <span className="field-hint" style={{ color: 'var(--color-primary-dark, #2d3b2a)', display: 'block', marginTop: '4px' }}>
                      ℹ️ Existing MongoDB image is preserved unless you change the URL or upload a new file.
                    </span>
                  )}
                  {errors.image && <span className="field-error-message">{errors.image}</span>}

                  {/* Live Image Preview Card */}
                  <div className="image-preview-container">
                    <span className="preview-label">Image Preview:</span>
                    {formData.image.trim() ? (
                      <div className="image-preview-wrapper">
                        <img 
                          key={formData.image}
                          src={normalizeProductImageUrl(formData.image)} 
                          alt="Product preview" 
                          className="preview-img"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            if (e.target.nextSibling) {
                              e.target.nextSibling.style.display = 'flex';
                            }
                          }}
                        />
                        <div className="preview-fallback" style={{ display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <img 
                            src={NEUTRAL_PLACEHOLDER_IMAGE} 
                            alt="Neutral placeholder" 
                            style={{ width: '80px', height: '80px', marginBottom: '8px' }} 
                          />
                          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>⚠️ Could not load image from this URL or path</span>
                        </div>
                      </div>
                    ) : (
                      <div className="preview-empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <img 
                          src={NEUTRAL_PLACEHOLDER_IMAGE} 
                          alt="Neutral placeholder" 
                          style={{ width: '64px', height: '64px', marginBottom: '8px', opacity: 0.8 }} 
                        />
                        <span>Enter an image URL, local path (/products/...) or browse to upload</span>
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
                    {formData.category !== 'Accessories' && (
                      <div className="size-quick-actions">
                        <button 
                          type="button" 
                          className="text-action-link"
                          onClick={handleSelectAllSizes}
                        >
                          All
                        </button>
                        <span className="action-divider">•</span>
                        <button 
                          type="button" 
                          className="text-action-link"
                          onClick={handleClearSizes}
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {formData.category === 'Accessories' ? (
                    <div className="accessory-one-size-box">
                      <div className="accessory-pill-wrap">
                        <div className="size-toggle-pill selected accessory-one-size-pill" aria-label="One Size auto-selected">
                          <span>One Size</span>
                          <span className="size-check-icon">✓</span>
                        </div>
                        <span className="accessory-auto-badge">Auto-Selected</span>
                      </div>
                      <span className="field-hint accessory-hint">
                        Accessories have only one size (<strong>One Size</strong>). Clothing size options (XS, S, M, L, XL, XXL) are disabled and hidden for this category.
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="sizes-pill-grid" role="group" aria-label="Size options">
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
                              <span>{size}</span>
                              {isSelected && <span className="size-check-icon">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                      <span className="field-hint">Select the sizes currently available in your warehouse.</span>
                    </>
                  )}
                  {errors.sizes && <span className="field-error-message">{errors.sizes}</span>}
                </div>

                {/* Size-Wise Inventory Table (Only show for selected sizes) */}
                <div className={`form-group ${errors.stock ? 'has-error' : ''}`}>
                  <div className="size-stock-card">
                    <div className="size-stock-card-header">
                      <div className="size-stock-card-title">
                        <span>Size-Wise Inventory</span>
                        <span className="required-star">*</span>
                      </div>
                      <span className="size-stock-total-badge">
                        Total Stock: <strong>{formData.stock || 0} units</strong>
                      </span>
                    </div>

                    {formData.sizes && formData.sizes.length > 0 ? (
                      <div className="size-stock-table-wrap">
                        <table className="size-stock-input-table">
                          <thead>
                            <tr>
                              <th>Size</th>
                              <th>Stock</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.sizes.map((sz) => {
                              const currentVal = formData.sizeStock?.[sz] !== undefined ? formData.sizeStock[sz] : 0;
                              const status = getSizeStockStatus(currentVal);
                              return (
                                <tr key={sz}>
                                  <td>
                                    <span className="size-badge-pill">{sz}</span>
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      className="size-stock-num-input"
                                      value={currentVal}
                                      onChange={(e) => handleSizeStockChange(sz, e.target.value)}
                                      placeholder="0"
                                      aria-label={`Stock for size ${sz}`}
                                    />
                                  </td>
                                  <td>
                                    <span className={`size-status-pill ${status.cls}`}>
                                      <span className="status-indicator-dot"></span>
                                      {status.label}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="empty-sizes-notice">
                        <span>Please select at least one available size above to configure size-wise inventory.</span>
                      </div>
                    )}
                  </div>
                  {errors.stock && <span className="field-error-message">{errors.stock}</span>}
                </div>

                {/* Colour Variants Management (Accessories Only) */}
                {formData.category === 'Accessories' && (
                  <div className="form-group color-variants-group">
                    <div className="color-variants-card">
                      <div className="color-variants-card-header">
                        <div>
                          <div className="color-variants-card-title">
                            <span>Colour Variants</span>
                            <span className="field-hint" style={{ display: 'inline', marginLeft: '6px' }}>(Optional)</span>
                          </div>
                          <p className="color-variants-card-desc">
                            Add genuine colour variations of this exact accessory model with their genuine images and stocks.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn-add-variant"
                          onClick={handleAddColorVariant}
                        >
                          ＋ Add Colour Variant
                        </button>
                      </div>

                      {formData.colorVariants && formData.colorVariants.length > 0 ? (
                        <div className="color-variants-list">
                          {formData.colorVariants.map((variant, index) => (
                            <div key={index} className="color-variant-row">
                              <div className="variant-field-group variant-name-field">
                                <label className="variant-sublabel">Colour Name</label>
                                <input
                                  type="text"
                                  className="form-input variant-input"
                                  placeholder="e.g. Beige, Black, Pink"
                                  value={variant.colorName}
                                  onChange={(e) => handleUpdateColorVariant(index, 'colorName', e.target.value)}
                                />
                              </div>

                              <div className="variant-field-group variant-color-field">
                                <label className="variant-sublabel">Swatch Hex</label>
                                <div className="variant-color-input-wrap">
                                  <input
                                    type="color"
                                    className="variant-color-picker"
                                    value={variant.colorCode || '#1c1c1c'}
                                    onChange={(e) => handleUpdateColorVariant(index, 'colorCode', e.target.value)}
                                    title="Choose swatch colour"
                                  />
                                  <input
                                    type="text"
                                    className="form-input variant-hex-input"
                                    placeholder="#1c1c1c"
                                    value={variant.colorCode}
                                    onChange={(e) => handleUpdateColorVariant(index, 'colorCode', e.target.value)}
                                  />
                                </div>
                              </div>

                              <div className="variant-field-group variant-stock-field">
                                <label className="variant-sublabel">Stock</label>
                                <input
                                  type="number"
                                  min="0"
                                  className="form-input variant-input variant-stock-input"
                                  value={variant.stock !== undefined ? variant.stock : 10}
                                  onChange={(e) => handleUpdateColorVariant(index, 'stock', e.target.value)}
                                />
                              </div>

                              <div className="variant-field-group variant-image-field">
                                <div className="variant-image-header">
                                  <label className="variant-sublabel">Genuine Image</label>
                                  <label htmlFor={`variant-file-${index}`} className="variant-upload-link">
                                    📁 Browse
                                  </label>
                                  <input
                                    id={`variant-file-${index}`}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={(e) => handleVariantImageFileUpload(index, e)}
                                  />
                                </div>
                                <div className="variant-image-input-wrap">
                                  {variant.image ? (
                                    <img
                                      src={normalizeProductImageUrl(variant.image)}
                                      alt="Variant thumb"
                                      className="variant-thumb-preview"
                                      onError={handleImageError}
                                    />
                                  ) : (
                                    <div className="variant-thumb-placeholder">📷</div>
                                  )}
                                  <input
                                    type="text"
                                    className="form-input variant-image-text"
                                    placeholder="Image URL or browse"
                                    value={variant.image ? (variant.image.startsWith('data:') ? '✓ Image uploaded (data URI)' : variant.image) : ''}
                                    onChange={(e) => handleUpdateColorVariant(index, 'image', e.target.value)}
                                  />
                                </div>
                              </div>

                              <button
                                type="button"
                                className="variant-remove-btn"
                                onClick={() => handleRemoveColorVariant(index)}
                                title="Remove variant"
                                aria-label="Remove variant"
                              >
                                🗑️
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-variants-box">
                          <span>No extra colour variants added. If this accessory is available in only one colour, you do not need to add variants.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>

            </div>

            {/* Form Footer Buttons */}
            <div className="form-actions-footer">
              <button 
                type="button" 
                className="btn-secondary form-cancel-btn" 
                onClick={handleCancel}
                disabled={isSaving}
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
                    <svg className="spinner-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12"></circle>
                    </svg>
                    <span>Saving Product...</span>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>{editingProduct ? 'Update Product' : 'Publish Product'}</span>
                  </>
                )}
              </button>
            </div>

          </form>

        </section>
      )}

      {/* 3. Products Catalog Table */}
      <section className="catalog-section" aria-labelledby="catalog-table-title">
        
        {/* Catalog Control Bar */}
        <div className="catalog-toolbar">
          
          <div className="toolbar-left">
            <h2 id="catalog-table-title" className="catalog-heading">Current Catalog</h2>
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
                  const stockCount = typeof prod.stock === 'number' ? prod.stock : 20;
                  const isLow = stockCount <= 5;
                  const itemSizes = Array.isArray(prod.sizes) && prod.sizes.length > 0 ? prod.sizes : ['S', 'M', 'L'];
                  const skuCode = prod._id 
                    ? `AUR-${prod._id.slice(-4).toUpperCase()}` 
                    : `AUR-${1000 + (prod.id || index)}`;

                  return (
                    <tr key={prod._id || prod.id || index}>
                      <td className="product-info-cell">
                        <img 
                          src={normalizeProductImageUrl(prod.image)} 
                          alt={prod.name} 
                          className="product-table-thumb" 
                          onError={handleImageError}
                        />
                        <div className="product-meta">
                          <span className="product-table-name">{prod.name}</span>
                          <span className="product-table-sub">SKU: {skuCode}</span>
                        </div>
                      </td>

                      <td>
                        <span className="category-pill">{prod.category}</span>
                      </td>

                      <td className="product-price-cell">
                        <strong>₹{Number(prod.price).toLocaleString('en-IN')}</strong>
                        {prod.mrp && Number(prod.mrp) > Number(prod.price) && (
                          <div className="product-table-mrp-group">
                            <span className="product-table-original-price">
                              MRP: ₹{Number(prod.mrp).toLocaleString('en-IN')}
                            </span>
                            <span className="admin-product-discount-badge">
                              {Math.round(((Number(prod.mrp) - Number(prod.price)) / Number(prod.mrp)) * 100)}% OFF
                            </span>
                          </div>
                        )}
                      </td>

                      <td>
                        <div className="table-sizes-row">
                          {itemSizes.map((s) => (
                            <span key={s} className="table-size-badge">{s}</span>
                          ))}
                        </div>
                      </td>

                      <td>
                        <div className="table-stock-cell">
                          <span className={`stock-badge ${stockCount === 0 ? 'out-of-stock' : isLow ? 'low-stock' : 'in-stock'}`}>
                            {stockCount === 0 ? 'Out of Stock' : `${stockCount} Units ${isLow ? '(Low)' : ''}`}
                          </span>
                          {prod.sizeStock && Object.keys(prod.sizeStock).length > 0 && (
                            <div className="table-size-stock-breakdown">
                              {Object.entries(prod.sizeStock).map(([sz, qty]) => {
                                const sNum = Number(qty) || 0;
                                const tagClass = sNum === 0 ? 'tag-out' : sNum <= 5 ? 'tag-low' : 'tag-ok';
                                return (
                                  <span key={sz} className={`table-size-tag ${tagClass}`} title={`${sz}: ${sNum} in stock`}>
                                    {sz}: {sNum}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>

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
                            title="Delete product from catalog"
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
