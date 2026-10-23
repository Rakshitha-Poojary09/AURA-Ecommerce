import React, { useState, useEffect, useRef, useMemo } from 'react';
import './ProductDetails.css';
import SizeGuideModal from './SizeGuideModal';
import ProductRecommendations from './ProductRecommendations';
import { normalizeProductImageUrl, handleImageError, NEUTRAL_PLACEHOLDER_IMAGE } from '../utils/imageUtils';

export const getReviewMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  return `http://localhost:5000${url.startsWith('/') ? '' : '/'}${url}`;
};

/**
 * Circular story video item with high-efficiency autoplay, continuous looping,
 * graceful fallback, viewport-based pause/resume, and tab visibility monitoring.
 */
function CircularVideoStory({
  review,
  onOpenModal,
  isModalOpen,
  handleImageError
}) {
  const itemRef = useRef(null);
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
  const [hasVideoError, setHasVideoError] = useState(false);
  const [isInViewport, setIsInViewport] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(
    typeof document !== 'undefined' ? document.hidden : false
  );

  const videoUrl = review.video?.url ? getReviewMediaUrl(review.video.url) : '';
  const posterUrl = review.video?.thumbnailUrl
    ? getReviewMediaUrl(review.video.thumbnailUrl)
    : videoUrl;

  // Track document visibility to pause when tab is inactive and resume when focused
  useEffect(() => {
    const handleVisibility = () => {
      setIsTabHidden(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // IntersectionObserver: Only activate decoding & playback when thumbnail is in the visible viewport
  useEffect(() => {
    const el = itemRef.current;
    if (!el) return;

    if (!('IntersectionObserver' in window)) {
      setIsInViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsInViewport(entry.isIntersecting && entry.intersectionRatio >= 0.2);
      },
      {
        threshold: [0, 0.2, 0.5],
        rootMargin: '40px 0px'
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Sync autoplay / pause based on viewport visibility, tab visibility, and modal state
  useEffect(() => {
    const video = videoRef.current;
    if (!video || hasVideoError || !videoUrl) return;

    let isDisposed = false;

    // Hard-set muted DOM properties to comply with browser autoplay policies
    video.muted = true;
    video.defaultMuted = true;

    const syncPlayback = async () => {
      const shouldPlay = isInViewport && !isTabHidden && !isModalOpen;

      if (shouldPlay) {
        try {
          video.muted = true;
          const playPromise = video.play();
          if (playPromise !== undefined) {
            await playPromise;
            if (!isDisposed) {
              setIsPlaying(true);
              setIsAutoplayBlocked(false);
            }
          }
        } catch (err) {
          if (!isDisposed) {
            if (err.name === 'NotAllowedError') {
              setIsAutoplayBlocked(true);
            }
            setIsPlaying(false);
          }
        }
      } else {
        if (!video.paused) {
          video.pause();
          if (!isDisposed) setIsPlaying(false);
        }
      }
    };

    syncPlayback();

    return () => {
      isDisposed = true;
      if (video && !video.paused) {
        video.pause();
      }
    };
  }, [isInViewport, isTabHidden, isModalOpen, hasVideoError, videoUrl]);

  const isVerifiedBuyer = review.isVerifiedPurchase === true;
  const isInfluencer = review.isInfluencer === true;

  return (
    <div
      ref={itemRef}
      className={`video-story-item ${isPlaying ? 'is-playing' : ''}`}
      role="listitem"
      onClick={onOpenModal}
      tabIndex={0}
      aria-label={`Watch video try-on review by ${review.customerName}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenModal();
        }
      }}
    >
      {/* Gradient Olive-Green & Blush Story Ring */}
      <div
        className={`video-story-ring ${isPlaying ? 'ring-active-playing' : ''}`}
        title={`Watch ${review.customerName}'s try-on`}
      >
        <div className="video-story-inner">
          {!hasVideoError && videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              poster={posterUrl}
              className="video-story-video"
              playsInline
              muted
              defaultMuted
              loop
              autoPlay
              preload="metadata"
              onPlay={() => {
                setIsPlaying(true);
                setIsAutoplayBlocked(false);
              }}
              onPause={() => setIsPlaying(false)}
              onError={() => {
                setHasVideoError(true);
                setIsPlaying(false);
              }}
            />
          ) : (
            <img
              src={posterUrl}
              alt={`Try-on look by ${review.customerName}`}
              className="video-story-avatar"
              loading="lazy"
              onError={handleImageError}
            />
          )}
        </div>

        {/* Small Play Icon Overlay Badge: Minimized when playing; visible when paused or autoplay blocked */}
        <div
          className={`video-story-play-badge ${isPlaying ? 'minimized' : ''} ${isAutoplayBlocked ? 'blocked-fallback' : ''}`}
          aria-hidden={isPlaying}
          title={isAutoplayBlocked ? 'Tap to play video' : undefined}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6 3 20 12 6 21 6 3"></polygon>
          </svg>
        </div>

        {/* Delicate live motion dot when playing */}
        {isPlaying && (
          <span className="story-live-motion-dot" title="Video playing" aria-hidden="true" />
        )}
      </div>

      {/* Customer Name & Short Label */}
      <div className="video-story-meta">
        <span className="video-story-name" title={review.customerName}>
          {review.customerName}
        </span>
        {isInfluencer ? (
          <span className="video-story-label influencer" title={review.influencerHandle || 'Influencer'}>
            ✦ {review.influencerHandle || 'Influencer'}
            {isVerifiedBuyer && ' • Buyer'}
          </span>
        ) : isVerifiedBuyer ? (
          <span className="video-story-label verified" title="Verified Buyer">
            ✓ Verified Buyer
          </span>
        ) : (
          <span className="video-story-label patron" title="Patron Try-On">
            Patron Try-On
          </span>
        )}
      </div>
    </div>
  );
}

export default function ProductDetails({
  product,
  allProducts = [],
  currentUser,
  onAddToCart,
  onBuyNow,
  onToggleWishlist,
  wishlistItems = [],
  onNavigate,
  onSelectProduct,
  showToast
}) {
  // If no product is provided, fallback to first item in MongoDB catalog
  const currentProduct = product || (allProducts && allProducts[0]) || null;

  if (!currentProduct) {
    return (
      <div className="aura-product-details-page">
        <div className="aura-container" style={{ textAlign: 'center', padding: '100px 20px' }}>
          <p style={{ color: 'var(--color-text-muted)' }}>Loading product details...</p>
        </div>
      </div>
    );
  }

  // Accessories category check
  const isAccessory = (currentProduct.category || '').toLowerCase() === 'accessories' ||
    (Array.isArray(currentProduct.sizes) && currentProduct.sizes.length === 1 && currentProduct.sizes[0] === 'One Size');

  // Genuine color variants from MongoDB / product catalog - strictly restricted to Accessories
  // Men's, Women's, and Kids' clothing do NOT have colour switching
  const colorVariants = isAccessory && Array.isArray(currentProduct.colorVariants) && currentProduct.colorVariants.length > 0
    ? currentProduct.colorVariants
    : [];

  const [selectedColor, setSelectedColor] = useState(() => {
    if (colorVariants.length === 0) return '';
    if (currentProduct.selectedColor) {
      const match = colorVariants.find(
        (v) => (v.colorName && v.colorName.toLowerCase() === currentProduct.selectedColor.toLowerCase()) ||
               (v.colorCode && v.colorCode.toLowerCase() === currentProduct.selectedColor.toLowerCase())
      );
      if (match) return match.colorName;
    }
    return colorVariants[0].colorName;
  });

  // Derive active variant matching selected color (Accessories only)
  const activeVariant = isAccessory && colorVariants.length > 0
    ? (colorVariants.find(
        (v) => (v.colorName && v.colorName.toLowerCase() === (selectedColor || '').toLowerCase()) ||
               (v.colorCode && v.colorCode.toLowerCase() === (selectedColor || '').toLowerCase())
      ) || colorVariants[0])
    : null;

  // Real gallery images from MongoDB product / active color variant
  const primaryImage = activeVariant
    ? normalizeProductImageUrl(activeVariant.image)
    : normalizeProductImageUrl(currentProduct.image);

  const galleryImages = activeVariant && Array.isArray(activeVariant.images) && activeVariant.images.length > 0
    ? activeVariant.images.map(normalizeProductImageUrl)
    : (Array.isArray(currentProduct.images) && currentProduct.images.length > 0
        ? currentProduct.images.map(normalizeProductImageUrl)
        : [primaryImage]);

  const [activeImage, setActiveImage] = useState(primaryImage);

  // Keep activeImage and variant in sync when product or selectedColor changes
  useEffect(() => {
    if (activeVariant) {
      setActiveImage(normalizeProductImageUrl(activeVariant.image));
    } else {
      setActiveImage(normalizeProductImageUrl(currentProduct.image));
    }
  }, [currentProduct.image, currentProduct._id, currentProduct.id, selectedColor, activeVariant]);

  // Keep selectedColor in sync when currentProduct or colorVariants change
  useEffect(() => {
    if (colorVariants.length > 0) {
      if (currentProduct.selectedColor) {
        const match = colorVariants.find(
          (v) => (v.colorName && v.colorName.toLowerCase() === currentProduct.selectedColor.toLowerCase()) ||
                 (v.colorCode && v.colorCode.toLowerCase() === currentProduct.selectedColor.toLowerCase())
        );
        if (match) {
          setSelectedColor(match.colorName);
          return;
        }
      }
      const exists = colorVariants.some(v => (v.colorName || '').toLowerCase() === (selectedColor || '').toLowerCase());
      if (!exists) {
        setSelectedColor(colorVariants[0].colorName);
      }
    } else {
      setSelectedColor('');
    }
  }, [currentProduct._id, currentProduct.id, currentProduct.selectedColor, colorVariants]);
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [sizeError, setSizeError] = useState(false);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState({
    details: true,
    sizing: false,
    shipping: false,
  });

  // Lock background scrolling and handle Escape key for Size Guide Modal
  useEffect(() => {
    if (isSizeGuideOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          setIsSizeGuideOpen(false);
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = prevOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isSizeGuideOpen]);

  // ------------------------------------------------------------------
  // Reviews & Ratings State
  // ------------------------------------------------------------------
  const [reviewsData, setReviewsData] = useState({
    reviews: [],
    totalReviews: 0,
    averageRating: 0,
    ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    isVerifiedPurchaser: false,
    userReview: null,
    canReview: false,
  });
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSuccessMessage, setReviewSuccessMessage] = useState('');
  const [showGuestNotice, setShowGuestNotice] = useState(false);
  const [deletingReviewId, setDeletingReviewId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [existingReviewPhotos, setExistingReviewPhotos] = useState([]);
  const [activeLightbox, setActiveLightbox] = useState(null);

  // Video Reviews Playback State (for viewing admin-published try-on videos)
  const [reviewFilter, setReviewFilter] = useState('all'); // 'all' | 'video' | 'photos' | '5star'
  const [activeVideoReview, setActiveVideoReview] = useState(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isVideoMuted, setIsVideoMuted] = useState(true); // Requirement 3: Do not autoplay with sound
  const [videoVolume, setVideoVolume] = useState(0.85);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const videoPlayerRef = useRef(null);

  const formatVideoTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const toggleVideoPlayPause = () => {
    if (!videoPlayerRef.current) return;
    if (videoPlayerRef.current.paused) {
      videoPlayerRef.current.play();
      setIsVideoPlaying(true);
    } else {
      videoPlayerRef.current.pause();
      setIsVideoPlaying(false);
    }
  };

  const toggleVideoMute = () => {
    if (!videoPlayerRef.current) return;
    const nextMuted = !isVideoMuted;
    videoPlayerRef.current.muted = nextMuted;
    setIsVideoMuted(nextMuted);
    if (!nextMuted) {
      const vol = videoVolume > 0 ? videoVolume : 0.85;
      setVideoVolume(vol);
      videoPlayerRef.current.volume = vol;
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
      } else {
        videoPlayerRef.current.muted = false;
        setIsVideoMuted(false);
      }
    }
  };

  const handleSeekChange = (e) => {
    const val = parseFloat(e.target.value);
    setVideoCurrentTime(val);
    if (videoPlayerRef.current) {
      videoPlayerRef.current.currentTime = val;
    }
  };

  const currentProductId = currentProduct?._id || currentProduct?.id;

  // Genuine reviews linked to this specific product
  const genuineProductReviews = useMemo(() => {
    if (!Array.isArray(reviewsData?.reviews)) return [];
    return reviewsData.reviews.filter((r) => {
      if (!r) return false;
      const rProdId = r.productId?._id || r.productId;
      return !rProdId || String(rProdId) === String(currentProductId);
    });
  }, [reviewsData?.reviews, currentProductId]);

  // Video reviews that possess a genuinely valid video URL
  const videoReviews = useMemo(() => {
    return genuineProductReviews.filter(
      (r) => r.video && typeof r.video.url === 'string' && r.video.url.trim().length > 0
    );
  }, [genuineProductReviews]);

  const activeVideoIndex = videoReviews.findIndex(
    (r) => String(r._id) === String(activeVideoReview?._id)
  );
  const hasPrevVideo = activeVideoIndex > 0;
  const hasNextVideo = activeVideoIndex >= 0 && activeVideoIndex < videoReviews.length - 1;

  const handlePrevVideo = () => {
    if (activeVideoIndex > 0) {
      setActiveVideoReview(videoReviews[activeVideoIndex - 1]);
      setVideoCurrentTime(0);
      setIsVideoPlaying(true);
    }
  };

  const handleNextVideo = () => {
    if (activeVideoIndex >= 0 && activeVideoIndex < videoReviews.length - 1) {
      setActiveVideoReview(videoReviews[activeVideoIndex + 1]);
      setVideoCurrentTime(0);
      setIsVideoPlaying(true);
    }
  };

  const handleShopThisProduct = () => {
    setActiveVideoReview(null);
    window.scrollTo({ top: 380, behavior: 'smooth' });
    if (showToast) {
      showToast(`Selected "${currentProduct.name}" — choose your size & add to bag! ✨`);
    }
  };

  // Keyboard shortcut listener for video modal & navigation between stories
  useEffect(() => {
    if (activeVideoReview) {
      setIsVideoMuted(true);
      setIsVideoPlaying(true);
      setVideoCurrentTime(0);

      const handleVideoKeyDown = (e) => {
        if (e.key === 'Escape') {
          setActiveVideoReview(null);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (activeVideoIndex > 0) {
            setActiveVideoReview(videoReviews[activeVideoIndex - 1]);
            setVideoCurrentTime(0);
            setIsVideoPlaying(true);
          }
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (activeVideoIndex >= 0 && activeVideoIndex < videoReviews.length - 1) {
            setActiveVideoReview(videoReviews[activeVideoIndex + 1]);
            setVideoCurrentTime(0);
            setIsVideoPlaying(true);
          }
        } else if (e.key === ' ' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          toggleVideoPlayPause();
        } else if (e.key.toLowerCase() === 'm') {
          toggleVideoMute();
        }
      };

      window.addEventListener('keydown', handleVideoKeyDown);
      return () => window.removeEventListener('keydown', handleVideoKeyDown);
    }
  }, [activeVideoReview, activeVideoIndex, videoReviews]);

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setReviewError('');

    const currentTotal = existingReviewPhotos.length + selectedFiles.length;
    const availableSlots = 5 - currentTotal;

    if (availableSlots <= 0) {
      setReviewError('You can upload a maximum of 5 photos per review.');
      e.target.value = '';
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const newSelected = [];

    for (const file of files) {
      if (newSelected.length >= availableSlots) {
        setReviewError('Maximum 5 photos allowed per review. Extra images were ignored.');
        break;
      }

      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const isAllowedExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
      const isAllowedMime = allowedTypes.includes((file.type || '').toLowerCase()) || isAllowedExt;

      if (!isAllowedMime) {
        setReviewError(`"${file.name}" has an unsupported format. Please select JPG, PNG, or WebP.`);
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        setReviewError(`"${file.name}" exceeds the 5MB file size limit.`);
        continue;
      }

      newSelected.push({
        id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name
      });
    }

    if (newSelected.length > 0) {
      setSelectedFiles((prev) => [...prev, ...newSelected]);
    }

    e.target.value = '';
  };

  const handleRemoveSelectedFile = (idToRemove) => {
    setSelectedFiles((prev) => {
      const target = prev.find((f) => f.id === idToRemove);
      if (target && target.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((f) => f.id !== idToRemove);
    });
  };

  const handleRemoveExistingPhoto = (photoId) => {
    setExistingReviewPhotos((prev) =>
      prev.filter((p) => String(p._id || p.filename) !== String(photoId))
    );
  };


  const fetchReviews = async () => {
    const prodId = currentProduct._id || currentProduct.id;
    if (!prodId) return;
    setIsLoadingReviews(true);
    try {
      const res = await fetch(`http://localhost:5000/api/products/${prodId}/reviews`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setReviewsData(data);
      }
    } catch (err) {
      console.warn('Failed to load reviews:', err);
    } finally {
      setIsLoadingReviews(false);
    }
  };

  useEffect(() => {
    fetchReviews();
    setIsReviewFormOpen(false);
    setEditingReviewId(null);
    setReviewTitle('');
    setReviewComment('');
    setReviewRating(5);
    setReviewError('');
    setShowGuestNotice(false);
  }, [currentProduct._id || currentProduct.id, currentUser]);

  const handleOpenWriteReview = () => {
    if (!currentUser) {
      setShowGuestNotice(true);
      return;
    }
    if (reviewsData.userReview) {
      handleOpenEditReview(reviewsData.userReview);
      return;
    }
    if (!reviewsData.isVerifiedPurchaser && !reviewsData.canReview) {
      return;
    }
    // Clean up any pending object URLs
    selectedFiles.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    setSelectedFiles([]);
    setExistingReviewPhotos([]);
    setEditingReviewId(null);
    setReviewRating(5);
    setReviewTitle('');
    setReviewComment('');
    setReviewError('');
    setIsReviewFormOpen(true);
  };

  const handleOpenEditReview = (existing) => {
    // Clean up any pending object URLs
    selectedFiles.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    setSelectedFiles([]);
    setExistingReviewPhotos(existing.photos || []);
    setEditingReviewId(existing._id);
    setReviewRating(existing.rating);
    setReviewTitle(existing.title);
    setReviewComment(existing.comment);
    setReviewError('');
    setIsReviewFormOpen(true);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setReviewError('');
    const cleanTitle = reviewTitle.trim();
    const cleanComment = reviewComment.trim();

    if (!cleanTitle) {
      setReviewError('Please provide a title for your review.');
      return;
    }
    if (!cleanComment) {
      setReviewError('Please write your thoughts in the comment section.');
      return;
    }
    if (reviewRating < 1 || reviewRating > 5) {
      setReviewError('Please select a star rating between 1 and 5.');
      return;
    }

    const prodId = currentProduct._id || currentProduct.id;
    setIsSubmittingReview(true);

    try {
      const formData = new FormData();
      formData.append('rating', reviewRating);
      formData.append('title', cleanTitle);
      formData.append('comment', cleanComment);

      // Append newly selected photos
      selectedFiles.forEach(({ file }) => {
        formData.append('photos', file);
      });

      // When editing, send the IDs of retained photos
      if (editingReviewId) {
        const retainedIds = existingReviewPhotos.map((p) => p._id || p.filename);
        formData.append('retainedPhotoIds', JSON.stringify(retainedIds));
      }

      let res;
      if (editingReviewId) {
        res = await fetch(`http://localhost:5000/api/reviews/${editingReviewId}`, {
          method: 'PUT',
          credentials: 'include',
          body: formData,
        });
      } else {
        res = await fetch(`http://localhost:5000/api/products/${prodId}/reviews`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Could not submit review.');
      }

      setIsReviewFormOpen(false);
      setEditingReviewId(null);
      setReviewTitle('');
      setReviewComment('');
      setReviewRating(5);
      selectedFiles.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
      setSelectedFiles([]);
      setExistingReviewPhotos([]);

      const msg = editingReviewId
        ? 'Your review has been updated ✨'
        : 'Thank you! Your fashion review has been published ✨';
      setReviewSuccessMessage(msg);
      if (showToast) showToast(msg);
      setTimeout(() => setReviewSuccessMessage(''), 4500);
      await fetchReviews();
    } catch (err) {
      setReviewError(err.message || 'Error saving review. Please try again.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete your review?')) return;
    setDeletingReviewId(reviewId);
    try {
      const res = await fetch(`http://localhost:5000/api/reviews/${reviewId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete review.');
      }
      if (showToast) showToast('Your review has been deleted.');
      setIsReviewFormOpen(false);
      setEditingReviewId(null);
      await fetchReviews();
    } catch (err) {
      alert(err.message || 'Error deleting review.');
    } finally {
      setDeletingReviewId(null);
    }
  };

  const renderStars = (rating) => {
    const num = Number(rating);
    const full = num > 0 ? Math.round(Math.min(5, Math.max(0, num))) : 0;
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  };

  const formatReviewDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (e) {
      return '';
    }
  };

  const availableSizes = isAccessory
    ? ['One Size']
    : (Array.isArray(currentProduct.sizes) && currentProduct.sizes.length > 0
        ? currentProduct.sizes
        : ['XS', 'S', 'M', 'L', 'XL']);

  // Auto-select size if only one size exists (e.g. 'One Size' for accessories/handbags)
  useEffect(() => {
    if (availableSizes.length === 1 && !selectedSize) {
      setSelectedSize(availableSizes[0]);
    }
  }, [availableSizes, selectedSize]);

  // Helper to get stock for a specific size and active color variant
  const getSizeStock = (sz) => {
    let sizeQty = null;
    if (currentProduct.sizeStock && typeof currentProduct.sizeStock === 'object') {
      if (typeof currentProduct.sizeStock[sz] === 'number') {
        sizeQty = Math.max(0, currentProduct.sizeStock[sz]);
      }
    }
    const variantQty = activeVariant && typeof activeVariant.stock === 'number' ? Math.max(0, activeVariant.stock) : null;
    
    if (sizeQty !== null && variantQty !== null) {
      return Math.min(sizeQty, variantQty);
    }
    if (variantQty !== null) {
      return variantQty;
    }
    if (sizeQty !== null) {
      return sizeQty;
    }
    return typeof currentProduct.stock === 'number' ? Math.max(0, currentProduct.stock) : 0;
  };

  // Entire product is out of stock only when ALL available options have 0 stock
  const isEntireProductOutOfStock = activeVariant
    ? (typeof activeVariant.stock === 'number' ? activeVariant.stock <= 0 : false)
    : (availableSizes.length > 0
        ? availableSizes.every((sz) => getSizeStock(sz) === 0)
        : (typeof currentProduct.stock === 'number' ? currentProduct.stock <= 0 : false));

  // Selected size stock level
  const selectedSizeStock = selectedSize ? getSizeStock(selectedSize) : null;
  const isSelectedSizeOutOfStock = selectedSizeStock !== null && selectedSizeStock === 0;

  // Active available stock for quantity selection (capping quantity by selected size stock)
  const activeAvailableStock = selectedSize
    ? selectedSizeStock
    : (activeVariant && typeof activeVariant.stock === 'number'
        ? Math.max(0, activeVariant.stock)
        : (typeof currentProduct.stock === 'number' ? Math.max(0, currentProduct.stock) : 0));

  // Auto-adjust quantity if stock drops below current quantity
  useEffect(() => {
    if (activeAvailableStock > 0 && quantity > activeAvailableStock) {
      setQuantity(activeAvailableStock);
    } else if (activeAvailableStock === 0 && quantity !== 1) {
      setQuantity(1);
    }
  }, [activeAvailableStock, quantity]);

  // Reset states when currentProduct changes
  useEffect(() => {
    setSelectedSize(availableSizes.length === 1 ? availableSizes[0] : '');
    setQuantity(1);
    setSizeError(false);
    if (isAccessory && colorVariants.length > 0) {
      const match = currentProduct.selectedColor
        ? colorVariants.find(
            (v) => (v.colorName && v.colorName.toLowerCase() === currentProduct.selectedColor.toLowerCase()) ||
                   (v.colorCode && v.colorCode.toLowerCase() === currentProduct.selectedColor.toLowerCase())
          )
        : null;
      const initialVariant = match || colorVariants[0];
      setSelectedColor(initialVariant.colorName);
      setActiveImage(normalizeProductImageUrl(initialVariant.image));
    } else {
      setActiveImage(normalizeProductImageUrl(currentProduct.image));
      setSelectedColor('');
    }
  }, [currentProduct._id, currentProduct.id, isAccessory]);

  const toggleAccordion = (section) => {
    setAccordionOpen((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleQuantityChange = (delta) => {
    if (isEntireProductOutOfStock || isSelectedSizeOutOfStock) return;
    setQuantity((prev) => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (next > activeAvailableStock) return activeAvailableStock;
      return next;
    });
  };

  const handleAddToCart = () => {
    if (isEntireProductOutOfStock) return;
    const sizeToUse = selectedSize || (availableSizes.length === 1 ? availableSizes[0] : '');
    if (!sizeToUse) {
      setSizeError(true);
      return;
    }
    const sizeStockQty = getSizeStock(sizeToUse);
    if (sizeStockQty <= 0) {
      setSizeError(true);
      return;
    }
    setSizeError(false);
    const chosenColorName = isAccessory && activeVariant
      ? activeVariant.colorName
      : (isAccessory && selectedColor ? selectedColor : 'Standard');
    const chosenColorCode = isAccessory && activeVariant ? activeVariant.colorCode : '';
    const chosenImage = isAccessory && activeVariant ? activeVariant.image : primaryImage;

    onAddToCart({
      ...currentProduct,
      selectedSize: sizeToUse,
      selectedColor: chosenColorName,
      color: chosenColorName,
      colorName: chosenColorName,
      colorCode: chosenColorCode,
      image: chosenImage,
      stock: sizeStockQty
    }, Math.min(quantity, sizeStockQty));
  };

  const handleBuyNow = () => {
    if (isBuyingNow) return;
    if (isEntireProductOutOfStock) {
      if (showToast) showToast('This item is currently out of stock.');
      return;
    }
    const sizeToUse = selectedSize || (availableSizes.length === 1 ? availableSizes[0] : '');
    if (!sizeToUse) {
      setSizeError(true);
      if (showToast) showToast('Please select an available size before purchasing.');
      return;
    }
    const sizeStockQty = getSizeStock(sizeToUse);
    if (sizeStockQty <= 0) {
      setSizeError(true);
      if (showToast) showToast(`Size ${sizeToUse} is currently out of stock.`);
      return;
    }

    setSizeError(false);
    setIsBuyingNow(true);

    try {
      const orderQty = Math.max(1, Math.min(quantity, sizeStockQty));
      const chosenColorName = isAccessory && activeVariant
        ? activeVariant.colorName
        : (isAccessory && selectedColor ? selectedColor : 'Standard');
      const chosenColorCode = isAccessory && activeVariant ? activeVariant.colorCode : '';
      const chosenImage = isAccessory && activeVariant ? activeVariant.image : currentProduct.image;
      const realId = currentProduct._id || currentProduct.id;

      const buyNowPayload = {
        ...currentProduct,
        id: realId,
        _id: realId,
        productId: realId,
        cartItemId: `buynow-${realId}-${sizeToUse}-${chosenColorName}`,
        name: currentProduct.name,
        category: currentProduct.category || 'Collection',
        price: Number(currentProduct.price) || 0,
        mrp: currentProduct.mrp || currentProduct.originalPrice || null,
        originalPrice: currentProduct.mrp || currentProduct.originalPrice || null,
        discount: currentProduct.discount,
        image: chosenImage,
        size: sizeToUse,
        selectedSize: sizeToUse,
        selectedColor: chosenColorName,
        color: chosenColorName,
        colorName: chosenColorName,
        colorCode: chosenColorCode,
        quantity: orderQty,
        stock: sizeStockQty,
        sizeStock: currentProduct.sizeStock || {},
      };

      if (onBuyNow) {
        onBuyNow(buyNowPayload);
      } else if (onNavigate) {
        onNavigate('checkout');
      }
    } finally {
      setTimeout(() => {
        setIsBuyingNow(false);
      }, 800);
    }
  };

  const isWishlisted = wishlistItems.some(
    (id) => String(id) === String(currentProduct._id) || String(id) === String(currentProduct.id)
  );

  // "You May Also Like" - 4 recommended products from live MongoDB catalog
  const currentKey = currentProduct.id || currentProduct._id;
  const relatedProducts = (allProducts || [])
    .filter((item) => (item.id || item._id) !== currentKey)
    .slice(0, 4);

  return (
    <div className="aura-product-details-page">
      <div className="aura-container">
        
        {/* 1. Breadcrumb Navigation */}
        <nav className="pdp-breadcrumb" aria-label="Breadcrumb">
          <button 
            className="pdp-breadcrumb-link" 
            onClick={() => onNavigate('home')}
          >
            Home
          </button>
          <span className="pdp-breadcrumb-sep">/</span>
          <button 
            className="pdp-breadcrumb-link" 
            onClick={() => onNavigate('shop', 'All')}
          >
            Shop
          </button>
          <span className="pdp-breadcrumb-sep">/</span>
          <button 
            className="pdp-breadcrumb-link" 
            onClick={() => onNavigate('shop', currentProduct.category)}
          >
            {currentProduct.category}
          </button>
          <span className="pdp-breadcrumb-sep">/</span>
          <span className="pdp-breadcrumb-active">{currentProduct.name}</span>
        </nav>

        {/* 2. Main Product Section */}
        <div className="pdp-main-grid">
          
          {/* Left: Product Image Gallery */}
          <div className="pdp-gallery-wrapper">
            {/* Vertical Thumbnails Column (rendered when multiple angles exist) */}
            {galleryImages.length > 1 && (
              <div className="pdp-thumbnails-strip">
                {galleryImages.map((imgSrc, idx) => (
                  <button
                    key={idx}
                    className={`pdp-thumbnail-btn ${activeImage === imgSrc ? 'active' : ''}`}
                    onClick={() => setActiveImage(imgSrc)}
                    aria-label={`View product image ${idx + 1}`}
                  >
                    <img src={imgSrc} alt={`Thumbnail ${idx + 1}`} loading="lazy" onError={handleImageError} />
                  </button>
                ))}
              </div>
            )}

            {/* Main Featured Image Column with Colour Thumbnails Below */}
            <div className="pdp-main-image-column">
              <div className="pdp-main-image-card">
                <img 
                  src={activeImage} 
                  alt={currentProduct.name} 
                  className="pdp-large-image" 
                  onError={handleImageError}
                />
                {/* Image Badge */}
                {(() => {
                  const effectiveMrp = currentProduct.mrp !== undefined && currentProduct.mrp !== null ? Number(currentProduct.mrp) : (currentProduct.originalPrice ? Number(currentProduct.originalPrice) : null);
                  const numPrice = Number(currentProduct.price) || 0;
                  const hasDiscount = effectiveMrp !== null && effectiveMrp > numPrice;
                  const discountPercent = hasDiscount ? Math.round(((effectiveMrp - numPrice) / effectiveMrp) * 100) : 0;

                  return hasDiscount && discountPercent > 0 ? (
                    <span className="pdp-discount-badge">{discountPercent}% OFF</span>
                  ) : null;
                })()}
              </div>

              {/* Colour Variant Thumbnail Selection - Strictly below main image for Accessories */}
              {isAccessory && colorVariants.length > 1 && (
                <div className="pdp-colour-thumbnails-container" aria-label="Available Colour Options">
                  <div className="pdp-colour-thumbnails-header">
                    <span className="pdp-colour-thumbnails-label">
                      Colour: <strong className="pdp-colour-name-val">{activeVariant?.colorName || selectedColor}</strong>
                    </span>
                    {activeVariant && (
                      <span className={`pdp-color-avail-badge ${activeVariant.stock === 0 ? 'out' : activeVariant.stock <= 5 ? 'low' : 'available'}`}>
                        {activeVariant.stock === 0
                          ? 'Out of Stock'
                          : activeVariant.stock <= 5
                          ? `Only ${activeVariant.stock} left`
                          : `${activeVariant.stock} in stock`}
                      </span>
                    )}
                  </div>
                  <div className="pdp-colour-thumbnails-strip" role="radiogroup" aria-label="Product colour thumbnails">
                    {colorVariants.map((variant) => {
                      const isSelected = (activeVariant?.colorName || '').toLowerCase() === (variant.colorName || '').toLowerCase();
                      const isOutOfStock = variant.stock === 0;

                      return (
                        <button
                          key={variant.colorName}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          aria-label={`Colour: ${variant.colorName}${isOutOfStock ? ' (Out of stock)' : ''}`}
                          title={`${variant.colorName}${isOutOfStock ? ' — Out of Stock' : ` (${variant.stock} available)`}`}
                          className={`pdp-colour-thumbnail-btn ${isSelected ? 'active' : ''} ${isOutOfStock ? 'out-of-stock' : ''}`}
                          onClick={() => {
                            setSelectedColor(variant.colorName);
                            setActiveImage(normalizeProductImageUrl(variant.image));
                          }}
                        >
                          <img 
                            src={normalizeProductImageUrl(variant.image)} 
                            alt={`${currentProduct.name} in ${variant.colorName}`}
                            className="pdp-colour-thumbnail-img"
                            onError={handleImageError}
                          />
                          <span className="pdp-colour-thumbnail-name">{variant.colorName}</span>
                          {isSelected && (
                            <span className="pdp-colour-thumbnail-badge" aria-hidden="true">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Single Available Colour Display - Accessories with exactly 1 colour option (no misleading extra options) */}
              {isAccessory && colorVariants.length === 1 && (
                <div className="pdp-colour-thumbnails-container" aria-label="Available Colour">
                  <div className="pdp-colour-thumbnails-header" style={{ marginBottom: 0 }}>
                    <span className="pdp-colour-thumbnails-label">
                      Colour: <strong className="pdp-colour-name-val">{colorVariants[0].colorName}</strong>
                    </span>
                    <span className={`pdp-color-avail-badge ${colorVariants[0].stock === 0 ? 'out' : colorVariants[0].stock <= 5 ? 'low' : 'available'}`}>
                      {colorVariants[0].stock === 0
                        ? 'Out of Stock'
                        : colorVariants[0].stock <= 5
                        ? `Only ${colorVariants[0].stock} left`
                        : `${colorVariants[0].stock} in stock`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Product Buy Box / Details */}
          <div className="pdp-info-wrapper">
            <span className="pdp-category-tag">{currentProduct.category} • {currentProduct.subCategory || 'Collection'}</span>
            <h1 className="pdp-product-title">{currentProduct.name}</h1>

            {/* Pricing Section */}
            <div className="pdp-price-row">
              {(() => {
                const effectiveMrp = currentProduct.mrp !== undefined && currentProduct.mrp !== null ? Number(currentProduct.mrp) : (currentProduct.originalPrice ? Number(currentProduct.originalPrice) : null);
                const numPrice = Number(currentProduct.price) || 0;
                const hasDiscount = effectiveMrp !== null && effectiveMrp > numPrice;
                const discountPercent = hasDiscount ? Math.round(((effectiveMrp - numPrice) / effectiveMrp) * 100) : 0;

                return (
                  <>
                    <span className="pdp-current-price">₹{numPrice.toLocaleString('en-IN')}</span>
                    {hasDiscount && (
                      <span className="pdp-original-price">₹{effectiveMrp.toLocaleString('en-IN')}</span>
                    )}
                    {hasDiscount && discountPercent > 0 && (
                      <span className="pdp-discount-pill">{discountPercent}% OFF</span>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Ratings, Reviews & Stock Status */}
            <div className="pdp-reviews-row">
              {reviewsData.totalReviews > 0 ? (
                <>
                  <div className="pdp-stars">
                    {renderStars(reviewsData.averageRating)}
                  </div>
                  <span className="pdp-rating-num">
                    {reviewsData.averageRating.toFixed(1)}
                  </span>
                  <a 
                    href="#pdp-reviews-section" 
                    className="pdp-review-count"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('pdp-reviews-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    ({reviewsData.totalReviews} {reviewsData.totalReviews === 1 ? 'review' : 'reviews'})
                  </a>
                </>
              ) : (
                <>
                  <div className="pdp-stars empty-stars">
                    ☆☆☆☆☆
                  </div>
                  <a 
                    href="#pdp-reviews-section" 
                    className="pdp-review-count unrated"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('pdp-reviews-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    No reviews yet (0)
                  </a>
                </>
              )}
              {isEntireProductOutOfStock ? (
                <span className="pdp-stock-status out-of-stock">• Out of Stock</span>
              ) : selectedSize ? (
                selectedSizeStock === 0 ? (
                  <span className="pdp-stock-status out-of-stock">• Size {selectedSize}: Out of Stock</span>
                ) : selectedSizeStock <= 5 ? (
                  <span className="pdp-stock-status low-stock">• Only {selectedSizeStock} left in Size {selectedSize}</span>
                ) : (
                  <span className="pdp-stock-status in-stock">• Size {selectedSize}: Available ({selectedSizeStock} in stock)</span>
                )
              ) : activeAvailableStock <= 5 ? (
                <span className="pdp-stock-status low-stock">• Only {activeAvailableStock} left in stock</span>
              ) : (
                <span className="pdp-stock-status in-stock">• In Stock ({activeAvailableStock} available)</span>
              )}
            </div>

            {/* Short Description */}
            <p className="pdp-short-desc">
              A timeless {currentProduct.name.toLowerCase()} crafted from breathable organic fabric with conscious attention to silhouette, draping, and movement. Perfect for elevated everyday wear and effortless versatility.
            </p>

            {/* Stock Availability Banner */}
            {isEntireProductOutOfStock ? (
              <div className="pdp-stock-banner out-of-stock">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Currently out of stock. Please check back later.</span>
              </div>
            ) : selectedSize && selectedSizeStock === 0 ? (
              <div className="pdp-stock-banner out-of-stock">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Size <strong>{selectedSize}</strong> is out of stock. Please select another available size.</span>
              </div>
            ) : selectedSize && selectedSizeStock <= 5 && selectedSizeStock > 0 ? (
              <div className="pdp-stock-banner low-stock">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                </svg>
                <span>Hurry! Only <strong>{selectedSizeStock} items</strong> left in Size {selectedSize}.</span>
              </div>
            ) : null}

            <div className="pdp-divider"></div>

            {/* Colour Variant Selection - Strictly for Accessories with genuine color variants */}
            {isAccessory && colorVariants.length > 1 && (
              <div className="pdp-option-group pdp-color-group">
                <div className="pdp-option-header">
                  <span className="pdp-option-label">
                    Colour: <strong className="pdp-selected-color-name">{activeVariant?.colorName || selectedColor}</strong>
                    {activeVariant && (
                      <span className={`pdp-color-avail-badge ${activeVariant.stock === 0 ? 'out' : activeVariant.stock <= 5 ? 'low' : 'available'}`}>
                        {activeVariant.stock === 0
                          ? 'Out of Stock'
                          : activeVariant.stock <= 5
                          ? `Only ${activeVariant.stock} left`
                          : `${activeVariant.stock} in stock`}
                      </span>
                    )}
                  </span>
                </div>

                <div className="pdp-color-options" role="radiogroup" aria-label="Product colour variants">
                  {colorVariants.map((variant) => {
                    const isSelected = (activeVariant?.colorName || '').toLowerCase() === (variant.colorName || '').toLowerCase();
                    const isOutOfStock = variant.stock === 0;

                    return (
                      <button
                        key={variant.colorName}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={`Colour: ${variant.colorName}${isOutOfStock ? ' (Out of stock)' : ''}`}
                        title={`${variant.colorName}${isOutOfStock ? ' — Out of Stock' : ` (${variant.stock} available)`}`}
                        className={`pdp-color-swatch-thumb ${isSelected ? 'selected' : ''} ${isOutOfStock ? 'out-of-stock-swatch' : ''}`}
                        onClick={() => {
                          setSelectedColor(variant.colorName);
                          setActiveImage(normalizeProductImageUrl(variant.image));
                        }}
                      >
                        <img 
                          src={normalizeProductImageUrl(variant.image)} 
                          alt={variant.colorName}
                          className="pdp-color-swatch-thumb-img"
                          onError={handleImageError}
                        />
                        <span className="pdp-color-swatch-thumb-label">{variant.colorName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Single Colour Label - When accessory has only 1 colour */}
            {isAccessory && colorVariants.length === 1 && (
              <div className="pdp-option-group pdp-color-group">
                <div className="pdp-option-header">
                  <span className="pdp-option-label">
                    Colour: <strong className="pdp-selected-color-name">{colorVariants[0].colorName}</strong>
                    <span className={`pdp-color-avail-badge ${colorVariants[0].stock === 0 ? 'out' : colorVariants[0].stock <= 5 ? 'low' : 'available'}`}>
                      {colorVariants[0].stock === 0
                        ? 'Out of Stock'
                        : colorVariants[0].stock <= 5
                        ? `Only ${colorVariants[0].stock} left`
                        : `${colorVariants[0].stock} in stock`}
                    </span>
                  </span>
                </div>
              </div>
            )}

            {/* Size Selection */}
            <div className="pdp-option-group">
              <div className="pdp-option-header">
                <span className="pdp-option-label">
                  Size: {selectedSize ? (
                    <>
                      <strong>{selectedSize}</strong>
                      <span className={`pdp-size-avail-badge ${selectedSizeStock === 0 ? 'out' : selectedSizeStock <= 5 ? 'low' : 'available'}`}>
                        {selectedSizeStock === 0
                          ? 'Out of Stock'
                          : selectedSizeStock <= 5
                          ? `Only ${selectedSizeStock} left`
                          : 'Available'}
                      </span>
                    </>
                  ) : (
                    <span className="pdp-size-hint">Please choose</span>
                  )}
                </span>
                {!isAccessory && (
                  <button 
                    type="button" 
                    className="pdp-size-guide-btn"
                    onClick={() => setIsSizeGuideOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={isSizeGuideOpen}
                  >
                    Size Guide
                  </button>
                )}
              </div>

              <div className="pdp-size-options">
                {availableSizes.map((size) => {
                  const sStock = getSizeStock(size);
                  const isSizeOut = sStock === 0;
                  const isSelected = selectedSize === size;

                  return (
                    <button
                      key={size}
                      type="button"
                      className={`pdp-size-pill has-sub ${isSelected ? 'selected' : ''} ${isSizeOut ? 'out-of-stock-size' : ''}`}
                      onClick={() => {
                        if (isSizeOut) return;
                        setSelectedSize(size);
                        setSizeError(false);
                      }}
                      disabled={isSizeOut}
                      title={isSizeOut ? `${size} — Out of Stock` : `${size} — Available (${sStock} in stock)`}
                      aria-label={`Size ${size}: ${isSizeOut ? 'Out of Stock' : 'Available'}`}
                    >
                      <span className="pdp-size-pill-name">{size}</span>
                      <span className="pdp-size-pill-sub">
                        {isSizeOut ? 'Out of Stock' : 'Available'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {sizeError && (
                <p className="pdp-size-error-msg">
                  ⚠️ Please select an available size before adding to your bag.
                </p>
              )}
            </div>

            {/* Quantity Selector & Action Buttons */}
            <div className="pdp-purchase-actions">
              <div className={`pdp-qty-stepper ${isEntireProductOutOfStock || isSelectedSizeOutOfStock ? 'disabled-stepper' : ''}`}>
                <button 
                  className="pdp-qty-btn" 
                  onClick={() => handleQuantityChange(-1)}
                  disabled={isEntireProductOutOfStock || isSelectedSizeOutOfStock || quantity <= 1}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="pdp-qty-val">{isEntireProductOutOfStock || isSelectedSizeOutOfStock ? 0 : quantity}</span>
                <button 
                  className="pdp-qty-btn" 
                  onClick={() => handleQuantityChange(1)}
                  disabled={isEntireProductOutOfStock || isSelectedSizeOutOfStock || quantity >= activeAvailableStock}
                  aria-label="Increase quantity"
                  title={quantity >= activeAvailableStock ? `Maximum available stock (${activeAvailableStock}) reached` : 'Increase quantity'}
                >
                  +
                </button>
              </div>

              {/* Add to Bag Button */}
              <button 
                type="button"
                className={`btn-primary pdp-add-to-bag-btn ${isEntireProductOutOfStock || isSelectedSizeOutOfStock ? 'disabled-out-of-stock-btn' : ''}`}
                onClick={handleAddToCart}
                disabled={isEntireProductOutOfStock || isSelectedSizeOutOfStock}
                title={isEntireProductOutOfStock ? 'This item is out of stock' : isSelectedSizeOutOfStock ? 'This size is out of stock' : 'Add to Bag'}
              >
                {isEntireProductOutOfStock ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                    </svg>
                    Out of Stock
                  </>
                ) : isSelectedSizeOutOfStock ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                    </svg>
                    Size Out of Stock
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                      <line x1="3" y1="6" x2="21" y2="6"></line>
                      <path d="M16 10a4 4 0 0 1-8 0"></path>
                    </svg>
                    Add to Bag
                  </>
                )}
              </button>

              {/* Buy Now Button */}
              <button 
                type="button"
                className={`pdp-buy-now-btn ${isEntireProductOutOfStock || isSelectedSizeOutOfStock ? 'disabled-out-of-stock-btn' : ''}`}
                onClick={handleBuyNow}
                disabled={isEntireProductOutOfStock || isSelectedSizeOutOfStock || isBuyingNow}
                title={isEntireProductOutOfStock ? 'This item is out of stock' : isSelectedSizeOutOfStock ? 'This size is out of stock' : 'Buy Now'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                {isBuyingNow ? 'Processing...' : 'Buy Now'}
              </button>

              {/* Wishlist Button */}
              <button 
                className={`pdp-wishlist-toggle-btn ${isWishlisted ? 'wishlisted' : ''}`}
                onClick={() => onToggleWishlist(currentProduct)}
                aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                title={isWishlisted ? 'In Wishlist' : 'Add to Wishlist'}
              >
                <svg 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill={isWishlisted ? 'var(--color-primary)' : 'none'} 
                  stroke={isWishlisted ? 'var(--color-primary)' : 'currentColor'} 
                  strokeWidth="1.8"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
              </button>
            </div>

            {/* Delivery Highlights */}
            <div className="pdp-perks-box">
              <div className="pdp-perk-item">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="1" y="3" width="15" height="13"></rect>
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                  <circle cx="5.5" cy="18.5" r="2.5"></circle>
                  <circle cx="18.5" cy="18.5" r="2.5"></circle>
                </svg>
                <span>Free standard delivery on orders above ₹999</span>
              </div>
              <div className="pdp-perk-item">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                <span>14-day hassle-free return and exchange policy</span>
              </div>
            </div>

            {/* Accordion Sections: Product Details, Size Guide, Shipping & Returns */}
            <div className="pdp-accordions">
              
              {/* Product Details */}
              <div className="pdp-accordion-item">
                <button 
                  className="pdp-accordion-header" 
                  onClick={() => toggleAccordion('details')}
                  aria-expanded={accordionOpen.details}
                >
                  <span>Product Details</span>
                  <span className={`pdp-accordion-chevron ${accordionOpen.details ? 'open' : ''}`}>▼</span>
                </button>
                {accordionOpen.details && (
                  <div className="pdp-accordion-body">
                    <ul className="pdp-bullet-list">
                      <li><strong>Fabric:</strong> 100% Breathable Organic Cotton & Pure Linen Blend</li>
                      <li><strong>Fit:</strong> Relaxed silhouette designed for effortless movement</li>
                      <li><strong>Care Instructions:</strong> Machine wash gentle cold, lay flat to dry in shade</li>
                      <li><strong>Craftsmanship:</strong> Ethically designed & stitched with reinforced seam binding</li>
                      <li><strong>Model:</strong> 5'9" wearing size S</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Size Guide */}
              <div className="pdp-accordion-item">
                <button 
                  className="pdp-accordion-header" 
                  onClick={() => toggleAccordion('sizing')}
                  aria-expanded={accordionOpen.sizing}
                >
                  <span>Size Guide</span>
                  <span className={`pdp-accordion-chevron ${accordionOpen.sizing ? 'open' : ''}`}>▼</span>
                </button>
                {accordionOpen.sizing && (
                  <div className="pdp-accordion-body">
                    {isAccessory ? (
                      <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--color-text-muted)', lineHeight: '1.6' }}>
                        <strong>One Size:</strong> Designed with universal proportions engineered for everyday elegance and versatile wear. No size selection needed.
                      </p>
                    ) : (
                      <table className="pdp-size-table">
                        <thead>
                          <tr>
                            <th>Size</th>
                            <th>Bust (in)</th>
                            <th>Waist (in)</th>
                            <th>Hip (in)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr><td>XS</td><td>32 - 33</td><td>24 - 25</td><td>34 - 35</td></tr>
                          <tr><td>S</td><td>34 - 35</td><td>26 - 27</td><td>36 - 37</td></tr>
                          <tr><td>M</td><td>36 - 37</td><td>28 - 29</td><td>38 - 39</td></tr>
                          <tr><td>L</td><td>38 - 40</td><td>30 - 32</td><td>40 - 42</td></tr>
                          <tr><td>XL</td><td>41 - 43</td><td>33 - 35</td><td>43 - 45</td></tr>
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>

              {/* Shipping & Returns */}
              <div className="pdp-accordion-item">
                <button 
                  className="pdp-accordion-header" 
                  onClick={() => toggleAccordion('shipping')}
                  aria-expanded={accordionOpen.shipping}
                >
                  <span>Shipping & Returns</span>
                  <span className={`pdp-accordion-chevron ${accordionOpen.shipping ? 'open' : ''}`}>▼</span>
                </button>
                {accordionOpen.shipping && (
                  <div className="pdp-accordion-body">
                    <p>
                      We offer doorstep delivery across India. Orders are processed within 24 hours 
                      and arrive within 3-5 business days. We gladly accept returns of unworn, 
                      unwashed items with tags attached within 14 days of receipt.
                    </p>
                  </div>
                )}
              </div>

            </div>

          </div>

          {/* 3. "You May Also Like" Product Recommendations Section */}
          <ProductRecommendations
            currentProduct={currentProduct}
            allProducts={allProducts}
            wishlistItems={wishlistItems}
            onToggleWishlist={onToggleWishlist}
            onSelectProduct={onSelectProduct}
            onNavigate={onNavigate}
          />

        </div>

        {/* ================================================================== */}
        {/* Customer Reviews & Ratings Section */}
        {/* ================================================================== */}
        <section id="pdp-reviews-section" className="pdp-reviews-section">
          <div className="reviews-header-wrap">
            <span className="section-eyebrow">CLIENT FEEDBACK & APPRAISAL</span>
            <h2 className="section-title">Customer Reviews & Ratings</h2>
            <p className="reviews-subtitle">
              Authentic reviews from verified purchasers of the AURA collection.
            </p>
          </div>

          {/* Success Notification Banner */}
          {reviewSuccessMessage && (
            <div className="review-success-alert" role="status">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>{reviewSuccessMessage}</span>
            </div>
          )}

          {/* Guest Sign-In Notice Banner */}
          {showGuestNotice && (
            <div className="guest-login-notice" role="alert">
              <div className="guest-notice-content">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <div>
                  <h4>Account Sign In Required</h4>
                  <p>Please sign in to your AURA account to submit a review.</p>
                </div>
              </div>
              <div className="guest-notice-actions">
                <button 
                  type="button"
                  className="guest-sign-in-btn"
                  onClick={() => onNavigate && onNavigate('login')}
                >
                  Sign In to Review
                </button>
                <button 
                  type="button"
                  className="guest-dismiss-btn"
                  onClick={() => setShowGuestNotice(false)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Reviews Summary Card */}
          <div className="pdp-reviews-summary-card">
            {/* Column 1: Overall Score */}
            <div className="summary-score-col">
              <div className="big-rating-number">
                {reviewsData.totalReviews > 0 ? reviewsData.averageRating.toFixed(1) : '—'}
              </div>
              <div className="summary-stars-row">
                {renderStars(reviewsData.totalReviews > 0 ? reviewsData.averageRating : 0)}
              </div>
              <div className="summary-count-label">
                {reviewsData.totalReviews > 0 
                  ? `Based on ${reviewsData.totalReviews} approved ${reviewsData.totalReviews === 1 ? 'review' : 'reviews'}`
                  : 'No approved reviews yet'}
              </div>
            </div>

            {/* Column 2: Rating Distribution Bars */}
            <div className="summary-distribution-col">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = reviewsData.ratingDistribution[stars] || 0;
                const pct = reviewsData.totalReviews > 0
                  ? Math.round((count / reviewsData.totalReviews) * 100)
                  : 0;
                return (
                  <div key={stars} className="pdp-distribution-row">
                    <span className="dist-label">{stars} ★</span>
                    <div className="dist-bar-track" title={`${count} reviews (${pct}%)`}>
                      <div className="dist-bar-fill" style={{ width: `${pct}%` }}></div>
                    </div>
                    <span className="dist-count">{count}</span>
                  </div>
                );
              })}
            </div>

            {/* Column 3: Actions & Verified Status */}
            <div className="summary-action-col">
              {!currentUser ? (
                <button 
                  type="button"
                  className="btn-primary write-review-trigger-btn"
                  onClick={handleOpenWriteReview}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                  Write a Review
                </button>
              ) : reviewsData.userReview ? (
                <div className="user-review-status-box">
                  <div className="user-review-status-header">
                    <strong>Your Review</strong>
                    {reviewsData.userReview.status === 'hidden' ? (
                      <span className="user-review-badge hidden">Under Moderation</span>
                    ) : (
                      <span className="user-review-badge live">Live</span>
                    )}
                  </div>
                  <div className="user-review-actions-row">
                    <button
                      type="button"
                      className="btn-secondary edit-review-trigger-btn"
                      onClick={() => handleOpenEditReview(reviewsData.userReview)}
                    >
                      Edit Review
                    </button>
                    <button
                      type="button"
                      className="btn-secondary delete-review-trigger-btn"
                      onClick={() => handleDeleteReview(reviewsData.userReview._id)}
                      disabled={deletingReviewId === reviewsData.userReview._id}
                    >
                      {deletingReviewId === reviewsData.userReview._id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ) : (reviewsData.isVerifiedPurchaser || reviewsData.canReview) ? (
                <button 
                  type="button"
                  className="btn-primary write-review-trigger-btn"
                  onClick={handleOpenWriteReview}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                  Write a Review
                </button>
              ) : (
                <div className="verified-purchaser-notice">
                  <span>🔒 Only verified purchasers who have ordered this garment can submit a review.</span>
                </div>
              )}
            </div>
          </div>

          {/* 1. Patron & Influencer Try-Ons: Circular Story Review Experience */}
          <div className="pdp-video-reviews-reel-section" id="patron-try-ons-section">
            <div className="video-reel-header">
              <div className="video-reel-titles">
                <div className="video-reel-eyebrow">
                  <span className="live-sparkle">✦</span> STYLE IN MOTION
                </div>
                <h3 className="video-reel-title">Patron & Influencer Try-Ons</h3>
                <p className="video-reel-subtitle">
                  Watch real customer try-ons, fabric drape, fit details, and styling inspirations before you buy.
                </p>
              </div>
              {videoReviews.length > 0 && (
                <div className="video-reel-count-pill">
                  {videoReviews.length} {videoReviews.length === 1 ? 'Look' : 'Looks'}
                </div>
              )}
            </div>

            {videoReviews.length > 0 ? (
              <div className="video-stories-track" role="list" aria-label="Customer video try-on stories">
                {videoReviews.map((rev) => (
                  <CircularVideoStory
                    key={rev._id}
                    review={rev}
                    onOpenModal={() => setActiveVideoReview(rev)}
                    isModalOpen={Boolean(activeVideoReview)}
                    handleImageError={handleImageError}
                  />
                ))}
              </div>
            ) : (
              /* Tasteful Empty State */
              <div className="video-story-empty-state">
                <div className="video-story-empty-icon" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <polygon points="23 7 16 12 23 17 23 7"></polygon>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                  </svg>
                </div>
                <div className="video-story-empty-text">
                  <h4>No Video Try-Ons Yet</h4>
                  <p>
                    Be the first verified patron who ordered this piece to share a video review and styling inspiration.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Write / Edit Review Form */}
          {isReviewFormOpen && (
            <div className="pdp-review-form-card" id="pdp-review-form">
              <div className="form-title-bar">
                <h3>{editingReviewId ? 'Edit Your Review' : 'Write a Verified Review'}</h3>
                <button 
                  type="button"
                  className="form-close-btn"
                  onClick={() => setIsReviewFormOpen(false)}
                  aria-label="Close form"
                >
                  ✕
                </button>
              </div>

              {reviewError && (
                <div className="review-form-alert" role="alert">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <span>{reviewError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitReview}>
                {/* Star Picker */}
                <div className="star-picker-group">
                  <label>Overall Rating</label>
                  <div className="star-picker" onMouseLeave={() => setHoverRating(0)}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className={`star-picker-btn ${(hoverRating || reviewRating) >= star ? 'active' : ''}`}
                        onClick={() => setReviewRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        aria-label={`Rate ${star} star`}
                      >
                        ★
                      </button>
                    ))}
                    <span className="star-picker-label">
                      {(hoverRating || reviewRating) === 5 && '5 Stars — Exceptional'}
                      {(hoverRating || reviewRating) === 4 && '4 Stars — Very Good'}
                      {(hoverRating || reviewRating) === 3 && '3 Stars — Average'}
                      {(hoverRating || reviewRating) === 2 && '2 Stars — Fair'}
                      {(hoverRating || reviewRating) === 1 && '1 Star — Disappointing'}
                    </span>
                  </div>
                </div>

                {/* Title Input */}
                <div className="form-field-group">
                  <label htmlFor="review-title-input">Headline / Review Title</label>
                  <input
                    id="review-title-input"
                    type="text"
                    required
                    maxLength={120}
                    placeholder="e.g. Luxurious fabric, flattering drape and true-to-size fit"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    disabled={isSubmittingReview}
                  />
                </div>

                {/* Comment Textarea */}
                <div className="form-field-group">
                  <label htmlFor="review-comment-input">Written Critique</label>
                  <textarea
                    id="review-comment-input"
                    rows={4}
                    required
                    maxLength={2000}
                    placeholder="Describe the try-on, drape, texture, fabric quality, and how you style it..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    disabled={isSubmittingReview}
                  ></textarea>
                </div>

                {/* Photo Upload Section */}
                <div className="review-photo-upload-group">
                  <div className="photo-upload-header">
                    <label>
                      Add Photos{' '}
                      <span className="photo-count-pill">
                        {existingReviewPhotos.length + selectedFiles.length} / 5
                      </span>
                    </label>
                    <span className="photo-format-hint">JPG, PNG, WebP up to 5MB</span>
                  </div>

                  {/* Previews Grid: Existing Photos + Newly Selected Photos */}
                  {(existingReviewPhotos.length > 0 || selectedFiles.length > 0) && (
                    <div className="review-photo-previews-grid">
                      {/* Retained Existing Photos */}
                      {existingReviewPhotos.map((p) => (
                        <div key={p._id || p.filename} className="review-photo-preview-item">
                          <img
                            src={getReviewMediaUrl(p.url)}
                            alt={p.originalName || 'Review attachment'}
                            className="preview-img"
                          />
                          <button
                            type="button"
                            className="remove-photo-btn"
                            onClick={() => handleRemoveExistingPhoto(p._id || p.filename)}
                            title="Remove photo"
                            aria-label="Remove photo"
                          >
                            ✕
                          </button>
                          <span className="saved-photo-tag">Saved</span>
                        </div>
                      ))}

                      {/* Newly Selected Photos */}
                      {selectedFiles.map((item) => (
                        <div key={item.id} className="review-photo-preview-item new-upload">
                          <img
                            src={item.previewUrl}
                            alt={item.name}
                            className="preview-img"
                          />
                          <button
                            type="button"
                            className="remove-photo-btn"
                            onClick={() => handleRemoveSelectedFile(item.id)}
                            title="Remove photo"
                            aria-label="Remove photo"
                          >
                            ✕
                          </button>
                          <span className="new-photo-tag">New</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Drop Zone / Button */}
                  {existingReviewPhotos.length + selectedFiles.length < 5 && (
                    <div className="photo-dropzone">
                      <input
                        id="review-photo-input"
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        className="photo-file-input"
                        onChange={handlePhotoSelect}
                        disabled={isSubmittingReview}
                      />
                      <label htmlFor="review-photo-input" className="photo-dropzone-label">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                          <circle cx="12" cy="13" r="4"></circle>
                        </svg>
                        <span className="dropzone-text">
                          <strong>Choose Photos</strong> or drag & drop from your phone or device
                        </span>
                        <span className="dropzone-subtext">
                          Show the drape, fabric texture, or fit on you
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Form Buttons */}
                <div className="form-actions-row">
                  <button 
                    type="submit" 
                    className="submit-review-btn"
                    disabled={isSubmittingReview}
                  >
                    {isSubmittingReview 
                      ? 'Submitting...' 
                      : editingReviewId 
                        ? 'Update Review' 
                        : 'Publish Review'}
                  </button>
                  <button 
                    type="button" 
                    className="cancel-review-btn"
                    onClick={() => setIsReviewFormOpen(false)}
                    disabled={isSubmittingReview}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Filter Pills Bar */}
          {genuineProductReviews.length > 0 && (
            <div className="pdp-reviews-filter-bar">
              <span className="filter-bar-title">Filter Reviews:</span>
              <button
                type="button"
                className={`review-filter-pill ${reviewFilter === 'all' ? 'active' : ''}`}
                onClick={() => setReviewFilter('all')}
              >
                All Reviews ({genuineProductReviews.length})
              </button>
              <button
                type="button"
                className={`review-filter-pill ${reviewFilter === 'video' ? 'active' : ''}`}
                onClick={() => setReviewFilter('video')}
              >
                📹 With Video ({genuineProductReviews.filter((r) => r.video?.url && typeof r.video.url === 'string' && r.video.url.trim().length > 0).length})
              </button>
              <button
                type="button"
                className={`review-filter-pill ${reviewFilter === 'photos' ? 'active' : ''}`}
                onClick={() => setReviewFilter('photos')}
              >
                📷 With Photos ({genuineProductReviews.filter((r) => Array.isArray(r.photos) && r.photos.length > 0).length})
              </button>
              <button
                type="button"
                className={`review-filter-pill ${reviewFilter === '5star' ? 'active' : ''}`}
                onClick={() => setReviewFilter('5star')}
              >
                ★ 5 Stars ({genuineProductReviews.filter((r) => r.rating === 5).length})
              </button>
            </div>
          )}

          {/* Reviews List */}
          <div className="pdp-reviews-list">
            {isLoadingReviews ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                Loading reviews...
              </div>
            ) : genuineProductReviews.length === 0 ? (
              <div className="pdp-empty-reviews">
                <span className="empty-reviews-icon">✨</span>
                <h4>No reviews yet</h4>
                <p>Be the first verified customer who has purchased this piece to share a review.</p>
              </div>
            ) : (() => {
              const filteredReviews = genuineProductReviews.filter((rev) => {
                if (reviewFilter === 'video') return Boolean(rev.video?.url && typeof rev.video.url === 'string' && rev.video.url.trim().length > 0);
                if (reviewFilter === 'photos') return Array.isArray(rev.photos) && rev.photos.length > 0;
                if (reviewFilter === '5star') return rev.rating === 5;
                return true;
              });

              if (filteredReviews.length === 0) {
                return (
                  <div className="pdp-empty-reviews">
                    <span className="empty-reviews-icon">🔍</span>
                    <h4>No reviews yet for this filter</h4>
                    <p>Try selecting &ldquo;All Reviews&rdquo; to view all genuine customer reviews.</p>
                    <button
                      type="button"
                      className="review-filter-reset-btn"
                      onClick={() => setReviewFilter('all')}
                    >
                      Show All Reviews
                    </button>
                  </div>
                );
              }

              return filteredReviews.map((rev) => {
                const isOwner = currentUser && (
                  String(rev.customerId) === String(currentUser._id) ||
                  String(rev.customerId?._id) === String(currentUser._id)
                );

                return (
                  <article 
                    key={rev._id} 
                    className={`pdp-review-card ${isOwner ? 'user-pinned-review' : ''}`}
                  >
                    {isOwner && (
                      <span className="user-pinned-tag">Your Review</span>
                    )}

                    <div className="review-card-header">
                      <div className="reviewer-profile">
                        <div className="reviewer-avatar">
                          {(rev.customerName || 'Customer').charAt(0).toUpperCase()}
                        </div>
                        <div className="reviewer-meta">
                          <div className="reviewer-name-row">
                            <span className="reviewer-name">{rev.customerName || 'Customer'}</span>

                            {/* Influencer Badge - Only displayed when genuinely applicable */}
                            {rev.isInfluencer && (
                              <span className="influencer-badge">
                                ✦ {rev.influencerHandle || 'Influencer Partner'}
                              </span>
                            )}

                            {/* Verified Purchase Badge - Only displayed when backend confirms customer purchased */}
                            {Boolean(rev.isVerifiedPurchase === true) && (
                              <span className="verified-badge">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                Verified Purchase
                              </span>
                            )}
                          </div>
                          {rev.createdAt && (
                            <span className="review-date">{formatReviewDate(rev.createdAt)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Customer Rating */}
                    {typeof rev.rating === 'number' && rev.rating > 0 && (
                      <div className="review-card-stars" aria-label={`${rev.rating} out of 5 stars`}>
                        {renderStars(rev.rating)}
                      </div>
                    )}

                    {/* Review Title */}
                    {rev.title && rev.title.trim() && (
                      <h4 className="review-card-title">{rev.title}</h4>
                    )}

                    {/* Review Text */}
                    {rev.comment && rev.comment.trim() && (
                      <p className="review-card-comment">{rev.comment}</p>
                    )}

                    {/* Video Review Media Card (Vertical 9:16 Preview) - Only when valid video exists */}
                    {Boolean(rev.video && rev.video.url && typeof rev.video.url === 'string' && rev.video.url.trim().length > 0) && (
                      <div className="review-card-video-block">
                        <div 
                          className="review-video-preview-card"
                          onClick={() => setActiveVideoReview(rev)}
                          role="button"
                          tabIndex={0}
                          title="Click to play vertical try-on video"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setActiveVideoReview(rev);
                            }
                          }}
                        >
                          {rev.video.thumbnailUrl ? (
                            <img
                              src={getReviewMediaUrl(rev.video.thumbnailUrl)}
                              alt={`Try-on video by ${rev.customerName || 'Customer'}`}
                              className="review-video-thumb-img"
                              loading="lazy"
                            />
                          ) : (
                            <video
                              src={getReviewMediaUrl(rev.video.url)}
                              className="review-video-thumb-img"
                              muted
                              playsInline
                              preload="metadata"
                            />
                          )}
                          <div className="review-video-overlay-gradient"></div>
                          
                          <div className="review-video-play-btn-pulse">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                              <polygon points="6 4 20 12 6 20 6 4"></polygon>
                            </svg>
                          </div>

                          <span className="review-video-duration-tag">
                            {rev.video.duration ? `0:${rev.video.duration < 10 ? '0' : ''}${rev.video.duration}` : '9:16 Try-On'}
                          </span>

                          <div className="review-video-prompt-badge">
                            <span>▶ Watch Video Try-On</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Customer Review Photos Gallery */}
                    {Array.isArray(rev.photos) && rev.photos.length > 0 && (
                      <div className="review-card-photos-grid">
                        {rev.photos.map((photo, pIdx) => (
                          <button
                            key={photo._id || pIdx}
                            type="button"
                            className="review-photo-thumbnail-btn"
                            onClick={() =>
                              setActiveLightbox({
                                photos: rev.photos,
                                activeIndex: pIdx,
                                customerName: rev.customerName,
                                title: rev.title,
                                rating: rev.rating
                              })
                            }
                            title="Click to expand patron photo"
                            aria-label={`View full photo ${pIdx + 1} of ${rev.photos.length} for ${rev.title || 'review'}`}
                          >
                            <img
                              src={getReviewMediaUrl(photo.url)}
                              alt={`${rev.customerName || 'Customer'} review photo ${pIdx + 1} for ${currentProduct.name}`}
                              className="review-photo-thumbnail"
                              loading="lazy"
                            />
                            <span className="photo-zoom-badge">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                <line x1="11" y1="8" x2="11" y2="14"></line>
                                <line x1="8" y1="11" x2="14" y2="11"></line>
                              </svg>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {isOwner && (
                      <div className="review-card-footer">
                        <button 
                          type="button"
                          className="review-action-btn edit"
                          onClick={() => handleOpenEditReview(rev)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                          </svg>
                          Edit
                        </button>
                        <button 
                          type="button"
                          className="review-action-btn delete"
                          onClick={() => handleDeleteReview(rev._id)}
                          disabled={deletingReviewId === rev._id}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                          {deletingReviewId === rev._id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </article>
                );
              });
            })()}
          </div>
        </section>

        {/* ---------------------------------------------------- */}
        {/* Elegant 9:16 Video Review Player Modal / Story Viewer */}
        {/* ---------------------------------------------------- */}
          {activeVideoReview && (
            <div 
              className="pdp-video-modal-overlay" 
              onClick={() => setActiveVideoReview(null)}
              role="dialog"
              aria-modal="true"
              aria-label={`Fashion video review by ${activeVideoReview.customerName}`}
            >
              {/* Floating Story Navigation: Previous Button */}
              {videoReviews.length > 1 && (
                <button
                  type="button"
                  className={`video-modal-nav-btn prev ${!hasPrevVideo ? 'disabled' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevVideo();
                  }}
                  disabled={!hasPrevVideo}
                  aria-label="Previous video look"
                  title="Previous look (Left Arrow)"
                >
                  ‹
                </button>
              )}

              <div 
                className="pdp-video-modal-container" 
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="video-modal-close-btn"
                  onClick={() => setActiveVideoReview(null)}
                  title="Close Video (Esc)"
                  aria-label="Close video player"
                >
                  ✕
                </button>

                {/* Vertical 9:16 Video Player Container */}
                <div className="pdp-video-stage">
                  {/* Story Progress Segment Bars (Instagram Style) */}
                  {videoReviews.length > 1 && (
                    <div className="story-progress-segments" aria-label="Story progress">
                      {videoReviews.map((v, idx) => (
                        <div
                          key={v._id || idx}
                          className={`story-progress-segment ${idx === activeVideoIndex ? 'active' : idx < activeVideoIndex ? 'completed' : ''}`}
                          onClick={() => {
                            setActiveVideoReview(v);
                            setVideoCurrentTime(0);
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`Switch to story look ${idx + 1}`}
                        />
                      ))}
                    </div>
                  )}

                  <video
                    ref={videoPlayerRef}
                    src={getReviewMediaUrl(activeVideoReview.video?.url)}
                    className="fashion-video-element"
                    playsInline
                    autoPlay
                    muted={isVideoMuted}
                    loop
                    onTimeUpdate={() => {
                      if (videoPlayerRef.current) {
                        setVideoCurrentTime(videoPlayerRef.current.currentTime);
                      }
                    }}
                    onLoadedMetadata={() => {
                      if (videoPlayerRef.current) {
                        setVideoDuration(videoPlayerRef.current.duration);
                        videoPlayerRef.current.volume = videoVolume;
                      }
                    }}
                    onClick={toggleVideoPlayPause}
                  />

                  {/* Big Center Play/Pause indicator when paused */}
                  {!isVideoPlaying && (
                    <button
                      type="button"
                      className="video-center-play-trigger"
                      onClick={toggleVideoPlayPause}
                      aria-label="Play video"
                    >
                      ▶
                    </button>
                  )}

                  {/* Top Floating Controls & Badges */}
                  <div className="video-player-top-bar">
                    <div className="top-badge-wrap">
                      {activeVideoReview.isInfluencer && (
                        <span className="player-influencer-pill">
                          ✦ {activeVideoReview.influencerHandle || 'Influencer Partner'}
                        </span>
                      )}
                      {activeVideoReview.isVerifiedPurchase && (
                        <span className="player-verified-pill">
                          ✓ Verified Buyer
                        </span>
                      )}
                    </div>

                    {/* Sound Controls (Starts Muted - Tap to Unmute) */}
                    <button
                      type="button"
                      className={`player-sound-toggle-btn ${!isVideoMuted ? 'active-audio' : ''}`}
                      onClick={toggleVideoMute}
                      title={isVideoMuted ? 'Unmute video sound' : 'Mute video sound'}
                    >
                      {isVideoMuted ? (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <line x1="23" y1="9" x2="17" y2="15"></line>
                            <line x1="17" y1="9" x2="23" y2="15"></line>
                          </svg>
                          <span>Tap to Unmute</span>
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                          </svg>
                          <span>Sound On</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Bottom Playback Controls Bar */}
                  <div className="video-player-bottom-bar">
                    <div className="video-seekbar-wrapper">
                      <input
                        type="range"
                        min="0"
                        max={videoDuration || 100}
                        step="0.1"
                        value={videoCurrentTime}
                        onChange={handleSeekChange}
                        className="video-seekbar-input"
                        aria-label="Seek video playback"
                      />
                    </div>

                    <div className="video-controls-row">
                      <button
                        type="button"
                        className="video-play-btn"
                        onClick={toggleVideoPlayPause}
                        aria-label={isVideoPlaying ? 'Pause' : 'Play'}
                      >
                        {isVideoPlaying ? '❚❚' : '▶'}
                      </button>

                      <span className="video-time-readout">
                        {formatVideoTime(videoCurrentTime)} / {formatVideoTime(videoDuration)}
                      </span>

                      <div className="video-volume-slider-wrap" title="Adjust sound volume">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={isVideoMuted ? 0 : videoVolume}
                          onChange={handleVolumeChange}
                          className="volume-slider-input"
                          aria-label="Volume"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Video Review Info & "Shop This Product" Panel */}
                <div className="pdp-video-info-sidebar">
                  <div className="video-creator-header">
                    <div className="creator-avatar">
                      {(activeVideoReview.customerName || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div className="creator-meta">
                      <div className="creator-name-row">
                        <h4 className="creator-name">{activeVideoReview.customerName}</h4>
                        {activeVideoReview.isInfluencer && (
                          <span className="creator-handle-tag">
                            ✦ {activeVideoReview.influencerHandle || 'Creator'}
                          </span>
                        )}
                        {activeVideoReview.isVerifiedPurchase && (
                          <span className="creator-verified-tag">
                            ✓ Verified Buyer
                          </span>
                        )}
                      </div>
                      <div className="creator-sub-row">
                        <div className="creator-stars">
                          {renderStars(activeVideoReview.rating)}
                        </div>
                        <span className="creator-date">{formatReviewDate(activeVideoReview.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="video-review-body">
                    <h4 className="video-review-title">{activeVideoReview.title}</h4>
                    <p className="video-review-comment">{activeVideoReview.comment}</p>
                  </div>

                  {/* Product Connection & "Shop This Product" Button */}
                  <div className="video-product-connection-card">
                    <div className="prod-conn-media">
                      <img
                        src={normalizeProductImageUrl(currentProduct.image || (currentProduct.images && currentProduct.images[0]))}
                        alt={currentProduct.name}
                        className="prod-conn-thumb"
                        onError={handleImageError}
                      />
                    </div>
                    <div className="prod-conn-details">
                      <span className="prod-conn-label">FEATURED IN THIS TRY-ON</span>
                      <h4 className="prod-conn-title">{currentProduct.name}</h4>
                      <span className="prod-conn-price">₹{currentProduct.price?.toLocaleString('en-IN')}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-shop-this-product"
                      onClick={handleShopThisProduct}
                      id="video-shop-this-product-btn"
                    >
                      <span>Shop This Piece</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Floating Story Navigation: Next Button */}
              {videoReviews.length > 1 && (
                <button
                  type="button"
                  className={`video-modal-nav-btn next ${!hasNextVideo ? 'disabled' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextVideo();
                  }}
                  disabled={!hasNextVideo}
                  aria-label="Next video look"
                  title="Next look (Right Arrow)"
                >
                  ›
                </button>
              )}
            </div>
          )}

      </div>

      {/* Lightbox / Image Viewer Modal for Customer Review Photos */}
      {activeLightbox && (
        <div
          className="review-lightbox-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveLightbox(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Customer review photo viewer"
        >
          <div className="review-lightbox-modal">
            {/* Lightbox Header */}
            <div className="lightbox-header">
              <div className="lightbox-meta">
                <div className="lightbox-reviewer-row">
                  <span className="lightbox-reviewer-name">{activeLightbox.customerName}</span>
                  <div className="lightbox-stars">
                    {renderStars(activeLightbox.rating)}
                  </div>
                </div>
                <h4 className="lightbox-title">{activeLightbox.title}</h4>
                <span className="lightbox-counter">
                  Photo {activeLightbox.activeIndex + 1} of {activeLightbox.photos.length}
                </span>
              </div>
              <button
                type="button"
                className="lightbox-close-btn"
                onClick={() => setActiveLightbox(null)}
                aria-label="Close image viewer"
              >
                ✕
              </button>
            </div>

            {/* Lightbox Stage (Main View + Navigation) */}
            <div className="lightbox-stage">
              {activeLightbox.photos.length > 1 && (
                <button
                  type="button"
                  className="lightbox-nav-btn prev"
                  onClick={() =>
                    setActiveLightbox((prev) => ({
                      ...prev,
                      activeIndex:
                        (prev.activeIndex - 1 + prev.photos.length) % prev.photos.length
                    }))
                  }
                  aria-label="Previous photo"
                >
                  ‹
                </button>
              )}

              <div className="lightbox-image-wrap">
                <img
                  src={getReviewPhotoUrl(
                    activeLightbox.photos[activeLightbox.activeIndex]?.url
                  )}
                  alt={`${activeLightbox.customerName}'s review photo ${activeLightbox.activeIndex + 1}`}
                  className="lightbox-main-image"
                />
              </div>

              {activeLightbox.photos.length > 1 && (
                <button
                  type="button"
                  className="lightbox-nav-btn next"
                  onClick={() =>
                    setActiveLightbox((prev) => ({
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

            {/* Thumbnail Strip */}
            {activeLightbox.photos.length > 1 && (
              <div className="lightbox-thumb-strip">
                {activeLightbox.photos.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`lightbox-thumb-btn ${idx === activeLightbox.activeIndex ? 'active' : ''}`}
                    onClick={() =>
                      setActiveLightbox((prev) => ({ ...prev, activeIndex: idx }))
                    }
                  >
                    <img
                      src={getReviewPhotoUrl(p.url)}
                      alt={`Thumbnail ${idx + 1}`}
                      className="lightbox-strip-img"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upgraded Multi-Garment Size Guide Modal */}
      <SizeGuideModal
        isOpen={isSizeGuideOpen}
        onClose={() => setIsSizeGuideOpen(false)}
        product={currentProduct}
      />
    </div>
  );
}
