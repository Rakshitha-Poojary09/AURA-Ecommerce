import React, { useState, useEffect, useMemo, useRef } from 'react';
import './AdminReviews.css';
import { adminFetch } from '../utils/apiClient';
import { normalizeProductImageUrl, handleImageError } from '../utils/imageUtils';

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    hidden: 0,
    videoCount: 0,
    influencerCount: 0,
    averageRating: 0
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [actionInProgress, setActionInProgress] = useState(null);

  // Catalog products for product assignment
  const [catalogProducts, setCatalogProducts] = useState([]);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'approved' | 'hidden' | 'video' | 'influencer'
  const [ratingFilter, setRatingFilter] = useState('all'); // 'all' | '5' | '4' | '3' | '2' | '1'
  const [searchQuery, setSearchQuery] = useState('');

  // Delete Confirmation Modal State
  const [reviewToDelete, setReviewToDelete] = useState(null);

  // Photo Inspection Lightbox State
  const [adminLightbox, setAdminLightbox] = useState(null);

  // Video Inspection Lightbox State
  const [adminVideoModal, setAdminVideoModal] = useState(null);
  const videoPlayerRef = useRef(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoVolume, setVideoVolume] = useState(1);

  // Add Video / Influencer Review Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    productId: '',
    customerName: '',
    rating: 5,
    title: '',
    comment: '',
    isInfluencer: true,
    influencerHandle: '',
    isVerifiedPurchase: true,
    status: 'approved',
    videoType: 'file', // 'file' | 'url'
    videoUrl: '',
    videoFile: null,
    thumbnailUrl: '',
    thumbnailFile: null
  });

  // Edit Review Modal State
  const [editingReview, setEditingReview] = useState(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    productId: '',
    customerName: '',
    rating: 5,
    title: '',
    comment: '',
    status: 'approved',
    isInfluencer: false,
    influencerHandle: '',
    isVerifiedPurchase: true,
    videoType: 'file', // 'file' | 'url'
    videoUrl: '',
    videoFile: null,
    thumbnailUrl: '',
    thumbnailFile: null,
    removeVideo: false
  });


  const getMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }
    return `http://localhost:5000${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 4000);
  };

  /**
   * Helper to recompute stats strictly using approved reviews for averageRating
   */
  const calculateStats = (reviewList) => {
    const total = reviewList.length;
    const approvedReviews = reviewList.filter((r) => r.status !== 'hidden');
    const approved = approvedReviews.length;
    const hidden = total - approved;
    const videoCount = reviewList.filter((r) => r.video && r.video.url).length;
    const influencerCount = reviewList.filter((r) => r.isInfluencer).length;
    const averageRating =
      approved === 0
        ? 0
        : Math.round(
            (approvedReviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / approved) * 10
          ) / 10;
    return { total, approved, hidden, videoCount, influencerCount, averageRating };
  };

  /**
   * Fetch reviews from backend
   */
  const fetchReviews = async (isManual = false) => {
    if (isManual) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const response = await adminFetch('/api/admin/reviews');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch reviews (Status ${response.status})`);
      }

      const data = await response.json();
      const reviewList = Array.isArray(data) ? data : data.reviews || [];
      setReviews(reviewList);

      if (data.stats) {
        setStats({
          ...data.stats,
          videoCount: data.stats.videoCount || reviewList.filter((r) => r.video && r.video.url).length,
          influencerCount: reviewList.filter((r) => r.isInfluencer).length
        });
      } else {
        setStats(calculateStats(reviewList));
      }
    } catch (err) {
      console.error('Error fetching admin reviews:', err);
      setError(err.message || 'Could not load customer reviews.');
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  /**
   * Fetch catalog products for product selector
   */
  const fetchProducts = async () => {
    try {
      const response = await adminFetch('/api/products');
      if (response.ok) {
        const prods = await response.json();
        if (Array.isArray(prods)) {
          setCatalogProducts(prods);
          if (prods.length > 0 && !addForm.productId) {
            setAddForm((prev) => ({ ...prev, productId: prods[0]._id }));
          }
        }
      }
    } catch (err) {
      console.warn('Could not load products catalog for reviews:', err);
    }
  };

  useEffect(() => {
    fetchReviews();
    fetchProducts();
  }, []);

  /**
   * Toggle review status between 'approved' and 'hidden'
   */
  const handleToggleStatus = async (review) => {
    const nextStatus = review.status === 'hidden' ? 'approved' : 'hidden';
    setActionInProgress(review._id);

    try {
      const response = await adminFetch(`/api/admin/reviews/${review._id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Could not update review status.`);
      }

      setReviews((prev) => {
        const nextList = prev.map((r) => (r._id === review._id ? { ...r, status: nextStatus } : r));
        setStats(calculateStats(nextList));
        return nextList;
      });

      if (adminVideoModal && adminVideoModal._id === review._id) {
        setAdminVideoModal((prev) => ({ ...prev, status: nextStatus }));
      }

      showToast(
        nextStatus === 'approved'
          ? `Review approved and now publicly visible on the storefront ✨`
          : `Review hidden from storefront. It remains in database for admin records.`
      );
    } catch (err) {
      console.error('Error toggling review status:', err);
      showToast(`Error: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  /**
   * Confirm and execute permanent deletion of a review
   */
  const handleConfirmDelete = async () => {
    if (!reviewToDelete) return;
    const reviewId = reviewToDelete._id;
    setActionInProgress(reviewId);

    try {
      const response = await adminFetch(`/api/admin/reviews/${reviewId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to delete review.');
      }

      setReviews((prev) => {
        const nextList = prev.filter((r) => r._id !== reviewId);
        setStats(calculateStats(nextList));
        return nextList;
      });

      if (adminVideoModal && adminVideoModal._id === reviewId) {
        setAdminVideoModal(null);
      }

      showToast('Review permanently deleted from database.');
      setReviewToDelete(null);
    } catch (err) {
      console.error('Error deleting review:', err);
      showToast(`Failed to delete: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  /**
   * Open Edit Review Modal with current review details populated
   */
  const handleOpenEditModal = (review) => {
    setEditingReview(review);
    setEditForm({
      productId: review.productId?._id || review.productId || '',
      customerName: review.customerName || '',
      rating: Number(review.rating) || 5,
      title: review.title || '',
      comment: review.comment || '',
      status: review.status || 'approved',
      isInfluencer: Boolean(review.isInfluencer),
      influencerHandle: review.influencerHandle || '',
      isVerifiedPurchase: Boolean(review.isVerifiedPurchase),
      videoType: review.video?.url ? 'url' : 'file',
      videoUrl: review.video?.url || '',
      videoFile: null,
      thumbnailUrl: review.video?.thumbnailUrl || '',
      thumbnailFile: null,
      removeVideo: false
    });
  };

  /**
   * Handle Create Review as Admin (with video or photos)
   */
  const handleCreateReview = async (e) => {
    e.preventDefault();
    if (!addForm.productId) {
      showToast('Please select a product.');
      return;
    }
    if (!addForm.customerName.trim()) {
      showToast('Please enter the reviewer name.');
      return;
    }
    if (!addForm.title.trim()) {
      showToast('Please enter a review title.');
      return;
    }
    if (!addForm.comment.trim()) {
      showToast('Please enter a review caption / comment.');
      return;
    }

    setIsSubmittingAdd(true);
    try {
      const formData = new FormData();
      formData.append('productId', addForm.productId);
      formData.append('customerName', addForm.customerName.trim());
      formData.append('rating', String(addForm.rating));
      formData.append('title', addForm.title.trim());
      formData.append('comment', addForm.comment.trim());
      formData.append('status', addForm.status);
      formData.append('isInfluencer', String(addForm.isInfluencer));
      formData.append('influencerHandle', addForm.influencerHandle.trim());
      formData.append('isVerifiedPurchase', String(addForm.isVerifiedPurchase));

      if (addForm.videoType === 'file' && addForm.videoFile) {
        formData.append('video', addForm.videoFile);
      } else if (addForm.videoUrl.trim()) {
        formData.append('videoUrl', addForm.videoUrl.trim());
      }

      if (addForm.thumbnailFile) {
        formData.append('thumbnail', addForm.thumbnailFile);
      } else if (addForm.thumbnailUrl.trim()) {
        formData.append('thumbnailUrl', addForm.thumbnailUrl.trim());
      }

      const res = await adminFetch('/api/admin/reviews', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to create review.');
      }

      const data = await res.json();
      const createdReview = data.review;

      setReviews((prev) => {
        const nextList = [createdReview, ...prev];
        setStats(calculateStats(nextList));
        return nextList;
      });

      showToast('Video / influencer review added successfully ✨');
      setIsAddModalOpen(false);
      // Reset form
      setAddForm({
        productId: catalogProducts[0]?._id || '',
        customerName: '',
        rating: 5,
        title: '',
        comment: '',
        isInfluencer: true,
        influencerHandle: '',
        isVerifiedPurchase: true,
        status: 'approved',
        videoType: 'file',
        videoUrl: '',
        videoFile: null,
        thumbnailUrl: '',
        thumbnailFile: null
      });
    } catch (err) {
      console.error('Error submitting review as admin:', err);
      showToast(`Error: ${err.message}`);
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  /**
   * Handle Update Review as Admin
   */
  const handleUpdateReview = async (e) => {
    e.preventDefault();
    if (!editingReview) return;

    setIsSubmittingEdit(true);
    try {
      const formData = new FormData();
      if (editForm.productId) {
        formData.append('productId', editForm.productId);
      }
      formData.append('customerName', editForm.customerName.trim());
      formData.append('rating', String(editForm.rating));
      formData.append('title', editForm.title.trim());
      formData.append('comment', editForm.comment.trim());
      formData.append('status', editForm.status);
      formData.append('isInfluencer', String(editForm.isInfluencer));
      formData.append('influencerHandle', editForm.influencerHandle.trim());
      formData.append('isVerifiedPurchase', String(editForm.isVerifiedPurchase));

      if (editForm.removeVideo) {
        formData.append('removeVideo', 'true');
      } else {
        if (editForm.videoType === 'file' && editForm.videoFile) {
          formData.append('video', editForm.videoFile);
        } else if (editForm.videoUrl.trim()) {
          formData.append('videoUrl', editForm.videoUrl.trim());
        }

        if (editForm.thumbnailFile) {
          formData.append('thumbnail', editForm.thumbnailFile);
        } else if (editForm.thumbnailUrl.trim()) {
          formData.append('thumbnailUrl', editForm.thumbnailUrl.trim());
        }
      }

      const res = await adminFetch(`/api/admin/reviews/${editingReview._id}`, {
        method: 'PUT',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to update review.');
      }

      const data = await res.json();
      const updatedRev = data.review;

      setReviews((prev) => {
        const nextList = prev.map((r) => (r._id === editingReview._id ? updatedRev : r));
        setStats(calculateStats(nextList));
        return nextList;
      });

      if (adminVideoModal && adminVideoModal._id === editingReview._id) {
        setAdminVideoModal(updatedRev);
      }

      showToast('Review updated successfully ✨');
      setEditingReview(null);
    } catch (err) {
      console.error('Error updating review:', err);
      showToast(`Error: ${err.message}`);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  /**
   * Video Player Controls for Admin Video Lightbox
   * Note: Autoplay starts MUTED by default (Requirement 3: "Do not autoplay with sound")
   */
  const handleOpenVideoModal = (review) => {
    setAdminVideoModal(review);
    setIsVideoPlaying(true);
    setIsVideoMuted(true); // STRICT: Start muted!
    setVideoProgress(0);
  };

  const handleTogglePlay = () => {
    if (!videoPlayerRef.current) return;
    if (videoPlayerRef.current.paused) {
      videoPlayerRef.current.play();
      setIsVideoPlaying(true);
    } else {
      videoPlayerRef.current.pause();
      setIsVideoPlaying(false);
    }
  };

  const handleToggleMute = () => {
    if (!videoPlayerRef.current) return;
    const nextMuted = !videoPlayerRef.current.muted;
    videoPlayerRef.current.muted = nextMuted;
    setIsVideoMuted(nextMuted);
    if (!nextMuted && videoVolume === 0) {
      setVideoVolume(0.8);
      videoPlayerRef.current.volume = 0.8;
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVideoVolume(val);
    if (videoPlayerRef.current) {
      videoPlayerRef.current.volume = val;
      if (val === 0) {
        videoPlayerRef.current.muted = true;
        setIsVideoMuted(true);
      } else if (isVideoMuted) {
        videoPlayerRef.current.muted = false;
        setIsVideoMuted(false);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (!videoPlayerRef.current) return;
    setVideoProgress(videoPlayerRef.current.currentTime);
    setVideoDuration(videoPlayerRef.current.duration || 0);
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setVideoProgress(time);
    if (videoPlayerRef.current) {
      videoPlayerRef.current.currentTime = time;
    }
  };

  const formatSeconds = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  /**
   * Filter reviews based on status/media type, rating, and search query
   */
  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      // Status & Media Filter
      if (statusFilter === 'approved' && review.status === 'hidden') return false;
      if (statusFilter === 'hidden' && review.status !== 'hidden') return false;
      if (statusFilter === 'video' && (!review.video || !review.video.url)) return false;
      if (statusFilter === 'influencer' && !review.isInfluencer) return false;

      // Rating filter
      if (ratingFilter !== 'all') {
        if (Number(review.rating) !== Number(ratingFilter)) return false;
      }

      // Search query (customer name, handle, review title, comment, product title)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const custName = (review.customerName || '').toLowerCase();
        const handle = (review.influencerHandle || '').toLowerCase();
        const title = (review.title || '').toLowerCase();
        const comment = (review.comment || '').toLowerCase();
        const prodName = (review.productId?.title || review.productId?.name || '').toLowerCase();
        return (
          custName.includes(q) ||
          handle.includes(q) ||
          title.includes(q) ||
          comment.includes(q) ||
          prodName.includes(q)
        );
      }

      return true;
    });
  }, [reviews, statusFilter, ratingFilter, searchQuery]);

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return '—';
    }
  };

  const renderStars = (rating) => {
    const num = Math.max(1, Math.min(5, Math.round(Number(rating) || 5)));
    return (
      <span className="admin-stars-display" title={`${num} out of 5 stars`}>
        {'★'.repeat(num)}
        {'☆'.repeat(5 - num)}
      </span>
    );
  };

  return (
    <div className="admin-reviews-page">
      {/* 1. Header Section */}
      <div className="admin-page-header">
        <div className="header-titles">
          <div className="header-eyebrow">MODERATION & INFLUENCER REVIEWS</div>
          <h1 className="admin-page-title">Product Reviews & Try-On Videos</h1>
          <p className="admin-page-subtitle">
            Manage customer feedback, creator try-on videos (9:16), verify genuine purchases, and moderate ratings across the AURA catalog.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn-add-video-review"
            onClick={() => setIsAddModalOpen(true)}
            id="admin-add-video-review-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>+ Add Video Review</span>
          </button>

          <button
            type="button"
            className="btn-refresh-reviews"
            onClick={() => fetchReviews(true)}
            disabled={isRefreshing || loading}
            title="Refresh reviews from MongoDB"
            id="admin-reviews-refresh-btn"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={isRefreshing ? 'spinning' : ''}
            >
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* 2. Operational KPIs */}
      <div className="reviews-kpi-grid">
        <div className="reviews-kpi-card" onClick={() => setStatusFilter('all')} style={{ cursor: 'pointer' }}>
          <div className="kpi-icon-wrapper kpi-all">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <div className="kpi-text">
            <span className="kpi-label">Total Reviews</span>
            <span className="kpi-number">{stats.total}</span>
          </div>
          <span className="kpi-badge neutral">All time</span>
        </div>

        <div className="reviews-kpi-card" onClick={() => setStatusFilter('approved')} style={{ cursor: 'pointer' }}>
          <div className="kpi-icon-wrapper kpi-approved">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div className="kpi-text">
            <span className="kpi-label">Approved & Public</span>
            <span className="kpi-number">{stats.approved}</span>
          </div>
          <span className="kpi-badge positive">Storefront Live</span>
        </div>

        <div className="reviews-kpi-card" onClick={() => setStatusFilter('video')} style={{ cursor: 'pointer' }}>
          <div className="kpi-icon-wrapper kpi-video">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
          </div>
          <div className="kpi-text">
            <span className="kpi-label">Video Try-Ons</span>
            <span className="kpi-number">{stats.videoCount}</span>
          </div>
          <span className="kpi-badge accent">9:16 Vertical</span>
        </div>

        <div className="reviews-kpi-card" onClick={() => setStatusFilter('hidden')} style={{ cursor: 'pointer' }}>
          <div className="kpi-icon-wrapper kpi-hidden">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          </div>
          <div className="kpi-text">
            <span className="kpi-label">Hidden Reviews</span>
            <span className="kpi-number">{stats.hidden}</span>
          </div>
          <span className="kpi-badge alert">Suppressed</span>
        </div>

        <div className="reviews-kpi-card">
          <div className="kpi-icon-wrapper kpi-rating">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </div>
          <div className="kpi-text">
            <span className="kpi-label">Average Rating</span>
            <span className="kpi-number">{stats.averageRating ? `${stats.averageRating} / 5` : '—'}</span>
          </div>
          <span className="kpi-badge gold">Catalog Metric</span>
        </div>
      </div>

      {/* 3. Controls & Filter Bar */}
      <div className="reviews-control-bar">
        {/* Search Input */}
        <div className="reviews-search-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Search by reviewer, @handle, product, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="reviews-search-input"
            id="reviews-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status / Media Filter Tabs */}
        <div className="status-filter-group" role="group" aria-label="Filter by review status">
          <button
            type="button"
            className={`filter-pill-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
            id="filter-status-all"
          >
            All ({reviews.length})
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${statusFilter === 'video' ? 'active' : ''}`}
            onClick={() => setStatusFilter('video')}
            id="filter-status-video"
          >
            📹 Video Reviews ({stats.videoCount})
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${statusFilter === 'influencer' ? 'active' : ''}`}
            onClick={() => setStatusFilter('influencer')}
            id="filter-status-influencer"
          >
            ⭐ Influencers ({stats.influencerCount})
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${statusFilter === 'approved' ? 'active' : ''}`}
            onClick={() => setStatusFilter('approved')}
            id="filter-status-approved"
          >
            Approved ({stats.approved})
          </button>
          <button
            type="button"
            className={`filter-pill-btn ${statusFilter === 'hidden' ? 'active' : ''}`}
            onClick={() => setStatusFilter('hidden')}
            id="filter-status-hidden"
          >
            Hidden ({stats.hidden})
          </button>
        </div>

        {/* Rating Filter Dropdown */}
        <div className="rating-filter-wrapper">
          <label htmlFor="filter-rating-select" className="filter-label">Rating:</label>
          <select
            id="filter-rating-select"
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="rating-select-input"
          >
            <option value="all">All Ratings (1–5 ★)</option>
            <option value="5">5 Stars (★★★★★)</option>
            <option value="4">4 Stars (★★★★☆)</option>
            <option value="3">3 Stars (★★★☆☆)</option>
            <option value="2">2 Stars (★★☆☆☆)</option>
            <option value="1">1 Star (★☆☆☆☆)</option>
          </select>
        </div>
      </div>

      {/* 4. Active Filters Reset Strip */}
      {(statusFilter !== 'all' || ratingFilter !== 'all' || searchQuery) && (
        <div className="active-filters-strip">
          <span className="strip-label">Active Filters:</span>
          {statusFilter !== 'all' && (
            <span className="filter-tag">
              Filter: <strong>{statusFilter === 'video' ? 'Video Reviews' : statusFilter === 'influencer' ? 'Influencers' : statusFilter}</strong>
              <button onClick={() => setStatusFilter('all')}>✕</button>
            </span>
          )}
          {ratingFilter !== 'all' && (
            <span className="filter-tag">
              Rating: <strong>{ratingFilter} Stars</strong>
              <button onClick={() => setRatingFilter('all')}>✕</button>
            </span>
          )}
          {searchQuery && (
            <span className="filter-tag">
              Search: <strong>"{searchQuery}"</strong>
              <button onClick={() => setSearchQuery('')}>✕</button>
            </span>
          )}
          <button
            type="button"
            className="btn-clear-all-filters"
            onClick={() => {
              setStatusFilter('all');
              setRatingFilter('all');
              setSearchQuery('');
            }}
          >
            Reset All
          </button>
        </div>
      )}

      {/* 5. Error Banner */}
      {error && (
        <div className="admin-banner-alert error" role="alert">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{error}</span>
          <button className="banner-dismiss-btn" onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* 6. Main Reviews Table */}
      {loading ? (
        <div className="reviews-loading-card">
          <div className="reviews-spinner"></div>
          <p>Loading customer & video reviews from database...</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="reviews-empty-state">
          <div className="empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
          </div>
          <h3 className="empty-state-title">No Reviews Found</h3>
          <p className="empty-state-text">
            {reviews.length === 0
              ? 'No reviews have been created yet. You can add influencer video try-on reviews using the "+ Add Video Review" button above.'
              : 'No reviews matched the current filter criteria or search query.'}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '1rem' }}>
            {(statusFilter !== 'all' || ratingFilter !== 'all' || searchQuery) && (
              <button
                type="button"
                className="btn-reset-empty"
                onClick={() => {
                  setStatusFilter('all');
                  setRatingFilter('all');
                  setSearchQuery('');
                }}
              >
                Clear Filters
              </button>
            )}
            <button
              type="button"
              className="btn-add-video-review"
              onClick={() => setIsAddModalOpen(true)}
            >
              + Add Video Review
            </button>
          </div>
        </div>
      ) : (
        <div className="reviews-table-container">
          <div className="table-header-info">
            <span>Showing <strong>{filteredReviews.length}</strong> of {reviews.length} total reviews</span>
          </div>

          <div className="table-responsive-wrapper">
            <table className="admin-reviews-table">
              <thead>
                <tr>
                  <th>Reviewer</th>
                  <th>Product</th>
                  <th>Rating</th>
                  <th>Review & Media</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReviews.map((review) => {
                  const isHidden = review.status === 'hidden';
                  const prod = review.productId;
                  const prodName = prod?.title || prod?.name || 'Catalog Item';
                  const prodImage = prod?.image || (Array.isArray(prod?.images) && prod.images[0] ? prod.images[0] : null);
                  const isBusy = actionInProgress === review._id;
                  const hasVideo = Boolean(review.video && review.video.url);

                  return (
                    <tr
                      key={review._id}
                      className={`review-table-row ${isHidden ? 'row-hidden' : 'row-approved'} ${hasVideo ? 'row-has-video' : ''}`}
                    >
                      {/* 1. Reviewer Details */}
                      <td className="cell-customer">
                        <div className="customer-cell-content">
                          <div className={`customer-avatar-badge ${review.isInfluencer ? 'avatar-influencer' : ''}`}>
                            {review.isInfluencer ? '⭐' : (review.customerName ? review.customerName.charAt(0).toUpperCase() : 'C')}
                          </div>
                          <div className="customer-text">
                            <span className="customer-name-bold">{review.customerName || 'Anonymous Reviewer'}</span>
                            {review.isInfluencer && (
                              <span className="influencer-handle-tag">
                                {review.influencerHandle ? (review.influencerHandle.startsWith('@') ? review.influencerHandle : `@${review.influencerHandle}`) : 'Influencer Partner'}
                              </span>
                            )}
                            {review.customerId?.email && (
                              <span className="customer-email-sub">{review.customerId.email}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Product */}
                      <td className="cell-product">
                        <div className="product-cell-content">
                          {prod ? (
                            <>
                              {prodImage ? (
                                <img
                                  src={normalizeProductImageUrl(prodImage)}
                                  alt={prodName}
                                  className="product-thumb-img"
                                  onError={handleImageError}
                                />
                              ) : (
                                <div className="product-thumb-placeholder">👗</div>
                              )}
                              <div className="product-cell-meta">
                                <span className="product-title-text" title={prodName}>
                                  {prodName}
                                </span>
                                {prod?.category && (
                                  <span className="product-category-sub">{prod.category}</span>
                                )}
                                <a
                                  href={`http://localhost:5173/product/${prod._id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="product-storefront-link"
                                  title="View on storefront (opens new tab)"
                                >
                                  View on store ↗
                                </a>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="product-thumb-placeholder deleted-product-thumb" title="Product deleted from catalog">
                                📦
                              </div>
                              <div className="product-cell-meta">
                                <span className="product-title-text" style={{ fontStyle: 'italic', color: '#6b7280' }}>
                                  Deleted Product
                                </span>
                                <span className="product-category-sub" style={{ color: '#dc2626' }}>
                                  Removed from catalog
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </td>

                      {/* 3. Rating */}
                      <td className="cell-rating">
                        <div className="rating-cell-content">
                          {renderStars(review.rating)}
                          <span className="numeric-rating-tag">{review.rating}.0</span>
                        </div>
                      </td>

                      {/* 4. Review Details & Media */}
                      <td className="cell-details">
                        <div className="review-details-content">
                          <h4 className="review-title-text">{review.title}</h4>
                          <p className="review-comment-text">{review.comment}</p>

                          {/* Media: Video Thumbnail (9:16 Vertical Try-On) */}
                          {hasVideo && (
                            <div className="admin-video-preview-card">
                              <button
                                type="button"
                                className="admin-video-thumb-trigger"
                                onClick={() => handleOpenVideoModal(review)}
                                title="Play vertical try-on video"
                                aria-label="Play video review"
                              >
                                {review.video.thumbnailUrl ? (
                                  <img
                                    src={getMediaUrl(review.video.thumbnailUrl)}
                                    alt="Video thumbnail"
                                    className="admin-video-thumb-img"
                                  />
                                ) : (
                                  <div className="admin-video-thumb-fallback">
                                    <video
                                      src={getMediaUrl(review.video.url)}
                                      className="admin-video-thumb-img"
                                      muted
                                      preload="metadata"
                                    />
                                  </div>
                                )}
                                <div className="video-thumb-play-overlay">
                                  <div className="video-play-icon-circle">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                    </svg>
                                  </div>
                                  <span className="video-pill-tag">9:16 Video</span>
                                </div>
                              </button>
                              <div className="admin-video-info-meta">
                                <span className="video-meta-badge">
                                  📹 {review.isInfluencer ? 'Influencer Try-On' : 'Customer Video'}
                                </span>
                                <button
                                  type="button"
                                  className="btn-inspect-video-link"
                                  onClick={() => handleOpenVideoModal(review)}
                                >
                                  Watch Video Review ▶
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Customer Review Photos Thumbnails */}
                          {Array.isArray(review.photos) && review.photos.length > 0 && (
                            <div className="admin-review-photos-block">
                              <span className="admin-photo-count-badge">
                                📷 {review.photos.length} Photo{review.photos.length > 1 ? 's' : ''} Attached
                              </span>
                              <div className="admin-photos-strip">
                                {review.photos.map((p, idx) => (
                                  <button
                                    key={p._id || idx}
                                    type="button"
                                    className="admin-review-photo-thumb-btn"
                                    onClick={() =>
                                      setAdminLightbox({
                                        photos: review.photos,
                                        activeIndex: idx,
                                        review
                                      })
                                    }
                                    title="Click to inspect full photo"
                                    aria-label={`Inspect photo ${idx + 1}`}
                                  >
                                    <img
                                      src={getMediaUrl(p.url)}
                                      alt={p.originalName || `Review photo ${idx + 1}`}
                                      className="admin-review-photo-thumb-img"
                                      loading="lazy"
                                    />
                                    <span className="photo-inspect-lens">🔍</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Badges Row - Genuinely applicable only */}
                          <div className="review-badges-row">
                            {review.isInfluencer && (
                              <span className="badge-influencer-verified" title="Official influencer or creator try-on">
                                ⭐ Influencer Review
                              </span>
                            )}
                            {review.isVerifiedPurchase && (
                              <span className="badge-verified-purchase" title="Customer verified purchase">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                Verified Purchaser
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 5. Date */}
                      <td className="cell-date">
                        <span className="review-date-text">{formatDate(review.createdAt)}</span>
                      </td>

                      {/* 6. Status Badge */}
                      <td className="cell-status">
                        {isHidden ? (
                          <span className="status-badge badge-hidden" title="Hidden from storefront">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                              <line x1="1" y1="1" x2="23" y2="23"></line>
                            </svg>
                            Hidden
                          </span>
                        ) : (
                          <span className="status-badge badge-approved" title="Visible on storefront">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            Approved
                          </span>
                        )}
                      </td>

                      {/* 7. Actions */}
                      <td className="cell-actions">
                        <div className="actions-button-group">
                          {isHidden ? (
                            <button
                              type="button"
                              className="action-btn btn-approve"
                              onClick={() => handleToggleStatus(review)}
                              disabled={isBusy}
                              title="Approve and make visible to customers"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                              <span>Approve</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="action-btn btn-hide"
                              onClick={() => handleToggleStatus(review)}
                              disabled={isBusy}
                              title="Hide from customers on storefront"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                <line x1="1" y1="1" x2="23" y2="23"></line>
                              </svg>
                              <span>Hide</span>
                            </button>
                          )}

                          <button
                            type="button"
                            className="action-btn btn-edit"
                            onClick={() => handleOpenEditModal(review)}
                            disabled={isBusy}
                            title="Edit review text, rating, or media"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 20h9"></path>
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                            </svg>
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            className="action-btn btn-delete"
                            onClick={() => setReviewToDelete(review)}
                            disabled={isBusy}
                            title="Permanently delete review"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====================================================================
          7. MODAL: Video Player Lightbox (Requirement 3: Elegant player, sound controls, close, NO AUTOPLAY WITH SOUND)
          ==================================================================== */}
      {adminVideoModal && (
        <div
          className="admin-video-lightbox-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAdminVideoModal(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Video Review Inspector"
        >
          <div className="admin-video-lightbox-card">
            {/* Left/Main Column: 9:16 Vertical Video Player */}
            <div className="admin-player-container">
              <video
                ref={videoPlayerRef}
                src={getMediaUrl(adminVideoModal.video?.url)}
                poster={getMediaUrl(adminVideoModal.video?.thumbnailUrl)}
                className="admin-vertical-video-element"
                playsInline
                autoPlay
                muted={isVideoMuted}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsVideoPlaying(false)}
                onClick={handleTogglePlay}
              />

              {/* Sound prompt when muted */}
              {isVideoMuted && isVideoPlaying && (
                <button
                  type="button"
                  className="admin-tap-unmute-btn"
                  onClick={handleToggleMute}
                  aria-label="Unmute video"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <line x1="23" y1="9" x2="17" y2="15"></line>
                    <line x1="17" y1="9" x2="23" y2="15"></line>
                  </svg>
                  <span>Tap to Unmute</span>
                </button>
              )}

              {/* Top controls: 9:16 indicator & close */}
              <div className="admin-video-top-bar">
                <span className="admin-video-badge-916">9:16 Fashion Try-On</span>
                <button
                  type="button"
                  className="admin-video-close-btn"
                  onClick={() => setAdminVideoModal(null)}
                  title="Close player"
                >
                  ✕
                </button>
              </div>

              {/* Bottom Playback Scrubber & Controls */}
              <div className="admin-video-controls-overlay">
                <input
                  type="range"
                  min="0"
                  max={videoDuration || 100}
                  step="0.1"
                  value={videoProgress}
                  onChange={handleSeek}
                  className="admin-video-seeker"
                  aria-label="Video progress scrubber"
                />

                <div className="admin-controls-buttons-row">
                  <div className="left-playback-group">
                    <button
                      type="button"
                      className="admin-ctrl-btn"
                      onClick={handleTogglePlay}
                      title={isVideoPlaying ? 'Pause' : 'Play'}
                    >
                      {isVideoPlaying ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="6" y="4" width="4" height="16"></rect>
                          <rect x="14" y="4" width="4" height="16"></rect>
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                      )}
                    </button>

                    <button
                      type="button"
                      className="admin-ctrl-btn"
                      onClick={handleToggleMute}
                      title={isVideoMuted ? 'Unmute' : 'Mute'}
                    >
                      {isVideoMuted ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                          <line x1="23" y1="9" x2="17" y2="15"></line>
                          <line x1="17" y1="9" x2="23" y2="15"></line>
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                      )}
                    </button>

                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isVideoMuted ? 0 : videoVolume}
                      onChange={handleVolumeChange}
                      className="admin-volume-slider"
                      aria-label="Volume slider"
                    />

                    <span className="admin-video-time">
                      {formatSeconds(videoProgress)} / {formatSeconds(videoDuration)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Review Details & Connected Product Card */}
            <div className="admin-video-sidebar">
              <div className="sidebar-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className={`status-badge ${adminVideoModal.status === 'hidden' ? 'badge-hidden' : 'badge-approved'}`}>
                    {adminVideoModal.status === 'hidden' ? 'Hidden' : 'Approved'}
                  </span>
                  {adminVideoModal.isInfluencer && (
                    <span className="badge-influencer-verified">⭐ Influencer Review</span>
                  )}
                  {adminVideoModal.isVerifiedPurchase && (
                    <span className="badge-verified-purchase">✓ Verified Purchaser</span>
                  )}
                </div>

                <h3 className="sidebar-review-title">"{adminVideoModal.title}"</h3>

                <div className="sidebar-reviewer-info">
                  <div className="customer-avatar-badge avatar-influencer">
                    {adminVideoModal.isInfluencer ? '⭐' : 'C'}
                  </div>
                  <div>
                    <strong className="sidebar-author-name">{adminVideoModal.customerName}</strong>
                    {adminVideoModal.influencerHandle && (
                      <span className="sidebar-author-handle">
                        {adminVideoModal.influencerHandle.startsWith('@') ? adminVideoModal.influencerHandle : `@${adminVideoModal.influencerHandle}`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="sidebar-stars-row">
                  {renderStars(adminVideoModal.rating)}
                  <span className="sidebar-rating-num">{adminVideoModal.rating}.0 / 5.0</span>
                </div>

                <div className="sidebar-comment-quote">
                  <p>{adminVideoModal.comment}</p>
                </div>
              </div>

              {/* Requirement 6: Product Connection & "Shop This Product" */}
              {adminVideoModal.productId && (
                <div className="sidebar-product-card">
                  <div className="sidebar-card-eyebrow">LINKED PRODUCT</div>
                  <div className="sidebar-prod-grid">
                    <img
                      src={normalizeProductImageUrl(
                        adminVideoModal.productId.image ||
                        (Array.isArray(adminVideoModal.productId.images) && adminVideoModal.productId.images[0])
                      )}
                      alt={adminVideoModal.productId.title || adminVideoModal.productId.name}
                      className="sidebar-prod-thumb"
                      onError={handleImageError}
                    />
                    <div className="sidebar-prod-details">
                      <h4 className="sidebar-prod-title">
                        {adminVideoModal.productId.title || adminVideoModal.productId.name}
                      </h4>
                      <p className="sidebar-prod-category">{adminVideoModal.productId.category || 'Luxury Fashion'}</p>
                      <div className="sidebar-prod-price">₹{adminVideoModal.productId.price?.toLocaleString('en-IN')}</div>
                    </div>
                  </div>

                  <a
                    href={`http://localhost:5173/product/${adminVideoModal.productId._id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-shop-this-product"
                    id="btn-admin-shop-product"
                  >
                    <span>Shop / View Product Page ↗</span>
                  </a>
                </div>
              )}

              {/* Admin Moderation Actions */}
              <div className="sidebar-actions-strip">
                <button
                  type="button"
                  className={`action-btn ${adminVideoModal.status === 'hidden' ? 'btn-approve' : 'btn-hide'}`}
                  onClick={() => handleToggleStatus(adminVideoModal)}
                  disabled={actionInProgress === adminVideoModal._id}
                >
                  {adminVideoModal.status === 'hidden' ? '✓ Approve Review' : '🚫 Hide Review'}
                </button>

                <button
                  type="button"
                  className="action-btn btn-edit"
                  onClick={() => {
                    handleOpenEditModal(adminVideoModal);
                  }}
                >
                  ✎ Edit Details
                </button>

                <button
                  type="button"
                  className="action-btn btn-delete"
                  onClick={() => setReviewToDelete(adminVideoModal)}
                >
                  🗑 Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          8. MODAL: Add Video / Creator Review (Requirement 7 & 8)
          ==================================================================== */}
      {isAddModalOpen && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-form-modal-box">
            <div className="modal-header">
              <div className="modal-header-icon modal-icon-video">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <h3 className="modal-title">Add Video / Influencer Review</h3>
                <p className="modal-subtitle">
                  Upload a 9:16 vertical try-on video or feature an influencer try-on review for any product in the AURA catalog.
                </p>
              </div>
              <button
                type="button"
                className="modal-x-btn"
                onClick={() => setIsAddModalOpen(false)}
                disabled={isSubmittingAdd}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateReview} className="admin-review-form">
              {/* Product Selection */}
              <div className="form-group">
                <label className="form-label" htmlFor="add-product-select">
                  Select Product <span className="req">*</span>
                </label>
                <select
                  id="add-product-select"
                  className="form-input"
                  value={addForm.productId}
                  onChange={(e) => setAddForm({ ...addForm, productId: e.target.value })}
                  required
                >
                  {catalogProducts.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.title || p.name} — {p.category || 'Fashion'} (₹{p.price})
                    </option>
                  ))}
                </select>
              </div>

              {/* Reviewer Details Row */}
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="add-reviewer-name">
                    Reviewer / Creator Name <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    id="add-reviewer-name"
                    className="form-input"
                    placeholder="e.g. Maya Lin (Stylist)"
                    value={addForm.customerName}
                    onChange={(e) => setAddForm({ ...addForm, customerName: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="add-rating-select">
                    Rating <span className="req">*</span>
                  </label>
                  <select
                    id="add-rating-select"
                    className="form-input"
                    value={addForm.rating}
                    onChange={(e) => setAddForm({ ...addForm, rating: Number(e.target.value) })}
                  >
                    <option value="5">5 Stars — Excellent ★★★★★</option>
                    <option value="4">4 Stars — Very Good ★★★★☆</option>
                    <option value="3">3 Stars — Average ★★★☆☆</option>
                    <option value="2">2 Stars — Poor ★★☆☆☆</option>
                    <option value="1">1 Star — Terrible ★☆☆☆☆</option>
                  </select>
                </div>
              </div>

              {/* Badges & Handles Row */}
              <div className="form-badges-box">
                <label className="checkbox-control">
                  <input
                    type="checkbox"
                    checked={addForm.isInfluencer}
                    onChange={(e) => setAddForm({ ...addForm, isInfluencer: e.target.checked })}
                  />
                  <span>⭐ Mark as Influencer / Creator Review</span>
                </label>

                {addForm.isInfluencer && (
                  <div className="influencer-handle-input-wrap">
                    <label className="sub-label" htmlFor="add-influencer-handle">Influencer Handle / Tag:</label>
                    <input
                      type="text"
                      id="add-influencer-handle"
                      className="form-input form-input-sm"
                      placeholder="e.g. @mayastyle"
                      value={addForm.influencerHandle}
                      onChange={(e) => setAddForm({ ...addForm, influencerHandle: e.target.value })}
                    />
                  </div>
                )}

                <label className="checkbox-control">
                  <input
                    type="checkbox"
                    checked={addForm.isVerifiedPurchase}
                    onChange={(e) => setAddForm({ ...addForm, isVerifiedPurchase: e.target.checked })}
                  />
                  <span>✓ Mark as Verified Purchase</span>
                </label>
              </div>

              {/* Review Title & Comment */}
              <div className="form-group">
                <label className="form-label" htmlFor="add-review-title">
                  Review Headline <span className="req">*</span>
                </label>
                <input
                  type="text"
                  id="add-review-title"
                  className="form-input"
                  placeholder="e.g. Pure linen perfection with an effortless drape"
                  value={addForm.title}
                  onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                  maxLength={120}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="add-review-comment">
                  Review Caption & Try-On Notes <span className="req">*</span>
                </label>
                <textarea
                  id="add-review-comment"
                  className="form-textarea"
                  rows="3"
                  placeholder="Describe fit, fabric quality, styling recommendations, and wearability..."
                  value={addForm.comment}
                  onChange={(e) => setAddForm({ ...addForm, comment: e.target.value })}
                  maxLength={2000}
                  required
                ></textarea>
              </div>

              {/* Video Media Section (Requirement 1, 2 & 8) */}
              <div className="form-media-section">
                <div className="section-title-row">
                  <span className="media-section-title">📹 Video Review Media (9:16 Vertical)</span>
                  <div className="radio-toggle-group">
                    <label className={`radio-pill ${addForm.videoType === 'file' ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="videoType"
                        value="file"
                        checked={addForm.videoType === 'file'}
                        onChange={() => setAddForm({ ...addForm, videoType: 'file' })}
                      />
                      Upload Video File
                    </label>
                    <label className={`radio-pill ${addForm.videoType === 'url' ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="videoType"
                        value="url"
                        checked={addForm.videoType === 'url'}
                        onChange={() => setAddForm({ ...addForm, videoType: 'url' })}
                      />
                      Video URL / Sample
                    </label>
                  </div>
                </div>

                {addForm.videoType === 'file' ? (
                  <div className="file-upload-dropzone">
                    <input
                      type="file"
                      id="add-video-file-input"
                      accept="video/mp4,video/webm,video/quicktime"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setAddForm({ ...addForm, videoFile: file });
                        }
                      }}
                      className="hidden-file-input"
                    />
                    <label htmlFor="add-video-file-input" className="file-dropzone-label">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <polygon points="23 7 16 12 23 17 23 7"></polygon>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                      </svg>
                      {addForm.videoFile ? (
                        <div className="file-chosen-meta">
                          <strong>Selected: {addForm.videoFile.name}</strong>
                          <span>({(addForm.videoFile.size / (1024 * 1024)).toFixed(1)} MB)</span>
                        </div>
                      ) : (
                        <div className="file-prompt-text">
                          <strong>Click to select 9:16 vertical try-on video</strong>
                          <span>MP4, WebM, or MOV up to 60MB</span>
                        </div>
                      )}
                    </label>
                  </div>
                ) : (
                  <div className="video-url-input-block">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Paste genuine video URL"
                      value={addForm.videoUrl}
                      onChange={(e) => setAddForm({ ...addForm, videoUrl: e.target.value })}
                    />
                  </div>
                )}

                {/* Optional Custom Thumbnail */}
                <div className="thumbnail-field-wrap">
                  <label className="sub-label">Thumbnail URL (optional):</label>
                  <input
                    type="text"
                    className="form-input form-input-sm"
                    placeholder="e.g. /uploads/reviews/videos/fashion-tryon-1-thumb.jpg or external image URL"
                    value={addForm.thumbnailUrl}
                    onChange={(e) => setAddForm({ ...addForm, thumbnailUrl: e.target.value })}
                  />
                </div>
              </div>

              {/* Status Selection */}
              <div className="form-group">
                <label className="form-label">Review Status</label>
                <div className="status-radio-options">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="status"
                      value="approved"
                      checked={addForm.status === 'approved'}
                      onChange={() => setAddForm({ ...addForm, status: 'approved' })}
                    />
                    <span>Approved & Published to Storefront</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="status"
                      value="hidden"
                      checked={addForm.status === 'hidden'}
                      onChange={() => setAddForm({ ...addForm, status: 'hidden' })}
                    />
                    <span>Hidden (Suppressed)</span>
                  </label>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmittingAdd}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-confirm-submit"
                  disabled={isSubmittingAdd}
                  id="admin-submit-new-review-btn"
                >
                  {isSubmittingAdd ? 'Publishing Review...' : 'Publish Video Review ✨'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          9. MODAL: Edit Review (Requirement 7 & 8)
          ==================================================================== */}
      {editingReview && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-form-modal-box">
            <div className="modal-header">
              <div className="modal-header-icon modal-icon-edit">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <h3 className="modal-title">Edit Review Details</h3>
                <p className="modal-subtitle">
                  Product: <strong>{editingReview.productId?.title || editingReview.productId?.name || 'Catalog Item'}</strong>
                </p>
              </div>
              <button
                type="button"
                className="modal-x-btn"
                onClick={() => setEditingReview(null)}
                disabled={isSubmittingEdit}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateReview} className="admin-review-form">
              {/* Product Selection */}
              <div className="form-group">
                <label className="form-label" htmlFor="edit-product-select">
                  Select Product <span className="req">*</span>
                </label>
                <select
                  id="edit-product-select"
                  className="form-input"
                  value={editForm.productId}
                  onChange={(e) => setEditForm({ ...editForm, productId: e.target.value })}
                  required
                >
                  {catalogProducts.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.title || p.name} — {p.category || 'Fashion'} (₹{p.price})
                    </option>
                  ))}
                </select>
              </div>

              {/* Reviewer Details Row */}
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-reviewer-name">
                    Reviewer Name <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    id="edit-reviewer-name"
                    className="form-input"
                    value={editForm.customerName}
                    onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-rating-select">
                    Rating <span className="req">*</span>
                  </label>
                  <select
                    id="edit-rating-select"
                    className="form-input"
                    value={editForm.rating}
                    onChange={(e) => setEditForm({ ...editForm, rating: Number(e.target.value) })}
                  >
                    <option value="5">5 Stars — Excellent ★★★★★</option>
                    <option value="4">4 Stars — Very Good ★★★★☆</option>
                    <option value="3">3 Stars — Average ★★★☆☆</option>
                    <option value="2">2 Stars — Poor ★★☆☆☆</option>
                    <option value="1">1 Star — Terrible ★☆☆☆☆</option>
                  </select>
                </div>
              </div>

              {/* Badges Box */}
              <div className="form-badges-box">
                <label className="checkbox-control">
                  <input
                    type="checkbox"
                    checked={editForm.isInfluencer}
                    onChange={(e) => setEditForm({ ...editForm, isInfluencer: e.target.checked })}
                  />
                  <span>⭐ Mark as Influencer / Creator Review</span>
                </label>

                {editForm.isInfluencer && (
                  <div className="influencer-handle-input-wrap">
                    <label className="sub-label" htmlFor="edit-influencer-handle">Influencer Handle / Tag:</label>
                    <input
                      type="text"
                      id="edit-influencer-handle"
                      className="form-input form-input-sm"
                      placeholder="e.g. @sophiastyle"
                      value={editForm.influencerHandle}
                      onChange={(e) => setEditForm({ ...editForm, influencerHandle: e.target.value })}
                    />
                  </div>
                )}

                <label className="checkbox-control">
                  <input
                    type="checkbox"
                    checked={editForm.isVerifiedPurchase}
                    onChange={(e) => setEditForm({ ...editForm, isVerifiedPurchase: e.target.checked })}
                  />
                  <span>✓ Mark as Verified Purchase</span>
                </label>
              </div>

              {/* Title & Comment */}
              <div className="form-group">
                <label className="form-label" htmlFor="edit-review-title">
                  Review Headline <span className="req">*</span>
                </label>
                <input
                  type="text"
                  id="edit-review-title"
                  className="form-input"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  maxLength={120}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-review-comment">
                  Review Comment / Caption <span className="req">*</span>
                </label>
                <textarea
                  id="edit-review-comment"
                  className="form-textarea"
                  rows="3"
                  value={editForm.comment}
                  onChange={(e) => setEditForm({ ...editForm, comment: e.target.value })}
                  maxLength={2000}
                  required
                ></textarea>
              </div>

              {/* Video Media Management */}
              <div className="form-media-section">
                <div className="section-title-row">
                  <span className="media-section-title">📹 Video Review Media</span>
                  {editingReview.video?.url && !editForm.removeVideo && (
                    <label className="checkbox-control" style={{ color: '#dc2626' }}>
                      <input
                        type="checkbox"
                        checked={editForm.removeVideo}
                        onChange={(e) => setEditForm({ ...editForm, removeVideo: e.target.checked })}
                      />
                      <span>Remove Existing Video</span>
                    </label>
                  )}
                </div>

                {editingReview.video?.url && !editForm.removeVideo && (
                  <div className="current-video-preview-strip">
                    <span className="current-video-tag">Current Video:</span>
                    <a
                      href={getMediaUrl(editingReview.video.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="current-video-link"
                    >
                      {editingReview.video.url} ↗
                    </a>
                  </div>
                )}

                {!editForm.removeVideo && (
                  <div style={{ marginTop: '0.8rem' }}>
                    <div className="radio-toggle-group" style={{ marginBottom: '0.6rem' }}>
                      <label className={`radio-pill ${editForm.videoType === 'file' ? 'active' : ''}`}>
                        <input
                          type="radio"
                          name="editVideoType"
                          value="file"
                          checked={editForm.videoType === 'file'}
                          onChange={() => setEditForm({ ...editForm, videoType: 'file' })}
                        />
                        Upload Video File
                      </label>
                      <label className={`radio-pill ${editForm.videoType === 'url' ? 'active' : ''}`}>
                        <input
                          type="radio"
                          name="editVideoType"
                          value="url"
                          checked={editForm.videoType === 'url'}
                          onChange={() => setEditForm({ ...editForm, videoType: 'url' })}
                        />
                        Video URL / Link
                      </label>
                    </div>

                    {editForm.videoType === 'file' ? (
                      <div className="file-upload-dropzone">
                        <input
                          type="file"
                          id="edit-video-file-input"
                          accept="video/mp4,video/webm,video/quicktime"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              setEditForm({ ...editForm, videoFile: file });
                            }
                          }}
                          className="hidden-file-input"
                        />
                        <label htmlFor="edit-video-file-input" className="file-dropzone-label">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <polygon points="23 7 16 12 23 17 23 7"></polygon>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                          </svg>
                          {editForm.videoFile ? (
                            <div className="file-chosen-meta">
                              <strong>Selected: {editForm.videoFile.name}</strong>
                              <span>({(editForm.videoFile.size / (1024 * 1024)).toFixed(1)} MB)</span>
                            </div>
                          ) : (
                            <div className="file-prompt-text">
                              <strong>Click to replace with new 9:16 video file</strong>
                              <span>MP4, WebM, or MOV up to 60MB</span>
                            </div>
                          )}
                        </label>
                      </div>
                    ) : (
                      <div className="video-url-input-block">
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. /uploads/reviews/videos/fashion-tryon-1.mp4 or https://..."
                          value={editForm.videoUrl}
                          onChange={(e) => setEditForm({ ...editForm, videoUrl: e.target.value })}
                        />
                      </div>
                    )}

                    <div style={{ marginTop: '0.6rem' }}>
                      <label className="sub-label">Thumbnail URL (optional):</label>
                      <input
                        type="text"
                        className="form-input form-input-sm"
                        placeholder="e.g. /uploads/reviews/videos/fashion-tryon-1-thumb.jpg"
                        value={editForm.thumbnailUrl}
                        onChange={(e) => setEditForm({ ...editForm, thumbnailUrl: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Status Selection */}
              <div className="form-group">
                <label className="form-label">Review Status</label>
                <div className="status-radio-options">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="editStatus"
                      value="approved"
                      checked={editForm.status === 'approved'}
                      onChange={() => setEditForm({ ...editForm, status: 'approved' })}
                    />
                    <span>Approved & Visible on Storefront</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="editStatus"
                      value="hidden"
                      checked={editForm.status === 'hidden'}
                      onChange={() => setEditForm({ ...editForm, status: 'hidden' })}
                    />
                    <span>Hidden (Suppressed)</span>
                  </label>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setEditingReview(null)}
                  disabled={isSubmittingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-confirm-submit"
                  disabled={isSubmittingEdit}
                  id="admin-save-review-edit-btn"
                >
                  {isSubmittingEdit ? 'Saving Changes...' : 'Save Changes ✨'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          10. Delete Confirmation Modal
          ==================================================================== */}
      {reviewToDelete && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true">
          <div className="admin-modal-box">
            <div className="modal-header">
              <div className="modal-danger-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <div>
                <h3 className="modal-title">Permanently Delete Review?</h3>
                <p className="modal-subtitle">
                  This action is irreversible and will remove the review and associated media files from MongoDB and storage.
                </p>
              </div>
            </div>

            <div className="modal-review-preview">
              <div className="preview-row">
                <span className="preview-label">Reviewer:</span>
                <span className="preview-val">
                  {reviewToDelete.customerName} {reviewToDelete.isInfluencer ? `(Influencer ${reviewToDelete.influencerHandle || ''})` : ''}
                </span>
              </div>
              <div className="preview-row">
                <span className="preview-label">Product:</span>
                <span className="preview-val">
                  {reviewToDelete.productId?.title || reviewToDelete.productId?.name || 'Deleted Product'}
                </span>
              </div>
              <div className="preview-row">
                <span className="preview-label">Rating:</span>
                <span className="preview-val">{reviewToDelete.rating} / 5 Stars ({'★'.repeat(reviewToDelete.rating)})</span>
              </div>
              <div className="preview-row preview-comment-box">
                <span className="preview-label">Title:</span>
                <span className="preview-val font-semibold">"{reviewToDelete.title}"</span>
              </div>
            </div>

            <div className="modal-actions-row">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setReviewToDelete(null)}
                disabled={actionInProgress === reviewToDelete._id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-confirm-delete"
                onClick={handleConfirmDelete}
                disabled={actionInProgress === reviewToDelete._id}
                id="modal-confirm-delete-btn"
              >
                {actionInProgress === reviewToDelete._id ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          11. Photo Inspection Lightbox Modal
          ==================================================================== */}
      {adminLightbox && (
        <div
          className="admin-lightbox-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAdminLightbox(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Inspect review photo"
        >
          <div className="admin-lightbox-card">
            <div className="admin-lightbox-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span className="lightbox-customer-tag">
                    Customer: {adminLightbox.review?.customerName}
                  </span>
                  <span className={`status-badge ${adminLightbox.review?.status === 'hidden' ? 'badge-hidden' : 'badge-approved'}`}>
                    {adminLightbox.review?.status === 'hidden' ? 'Hidden' : 'Approved'}
                  </span>
                  <span className="lightbox-photo-counter">
                    Photo {adminLightbox.activeIndex + 1} of {adminLightbox.photos.length}
                  </span>
                </div>
                <h3 className="admin-lightbox-title">"{adminLightbox.review?.title}"</h3>
                <p className="admin-lightbox-product-subtitle">
                  Product: {adminLightbox.review?.productId?.title || adminLightbox.review?.productId?.name || 'Catalog Item'}
                </p>
              </div>

              <button
                type="button"
                className="admin-lightbox-close"
                onClick={() => setAdminLightbox(null)}
                aria-label="Close photo inspector"
              >
                ✕
              </button>
            </div>

            <div className="admin-lightbox-viewport">
              {adminLightbox.photos.length > 1 && (
                <button
                  type="button"
                  className="admin-lightbox-nav prev"
                  onClick={() =>
                    setAdminLightbox((prev) => ({
                      ...prev,
                      activeIndex: (prev.activeIndex - 1 + prev.photos.length) % prev.photos.length
                    }))
                  }
                  aria-label="Previous photo"
                >
                  ‹
                </button>
              )}

              <div className="admin-lightbox-img-wrap">
                <img
                  src={getMediaUrl(adminLightbox.photos[adminLightbox.activeIndex]?.url)}
                  alt={`Review photo ${adminLightbox.activeIndex + 1}`}
                  className="admin-lightbox-large-img"
                />
              </div>

              {adminLightbox.photos.length > 1 && (
                <button
                  type="button"
                  className="admin-lightbox-nav next"
                  onClick={() =>
                    setAdminLightbox((prev) => ({
                      ...prev,
                      activeIndex: (prev.activeIndex + 1) % prev.photos.length
                    }))
                  }
                  aria-label="Next photo"
                >
                  ›
                </button>
              )}
            </div>

            {adminLightbox.photos.length > 1 && (
              <div className="admin-lightbox-thumb-strip">
                {adminLightbox.photos.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`admin-thumb-strip-btn ${idx === adminLightbox.activeIndex ? 'active' : ''}`}
                    onClick={() =>
                      setAdminLightbox((prev) => ({ ...prev, activeIndex: idx }))
                    }
                  >
                    <img
                      src={getMediaUrl(p.url)}
                      alt={`Photo ${idx + 1}`}
                      className="admin-thumb-strip-img"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="admin-lightbox-footer">
              <span className="lightbox-footer-comment">
                Critique: {adminLightbox.review?.comment}
              </span>

              <div className="lightbox-footer-actions">
                <button
                  type="button"
                  className={`action-btn ${adminLightbox.review?.status === 'hidden' ? 'btn-approve' : 'btn-hide'}`}
                  onClick={() => {
                    handleToggleStatus(adminLightbox.review);
                    setAdminLightbox((prev) => ({
                      ...prev,
                      review: {
                        ...prev.review,
                        status: prev.review.status === 'hidden' ? 'approved' : 'hidden'
                      }
                    }));
                  }}
                  disabled={actionInProgress === adminLightbox.review?._id}
                >
                  {adminLightbox.review?.status === 'hidden' ? '✓ Approve & Publish' : '🚫 Hide Review'}
                </button>

                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setAdminLightbox(null)}
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          12. Toast Notification
          ==================================================================== */}
      {toastMessage && (
        <div className="admin-reviews-toast" role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
