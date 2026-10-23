import React, { useState, useEffect, useRef, useMemo } from 'react';
import './PatronTryOnsReel.css';
import { normalizeProductImageUrl, handleImageError } from '../utils/imageUtils';
import { API_BASE } from '../utils/apiConfig';

const BACKEND_URL = API_BASE;

const getMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  return `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

/**
 * Single Circular Video Story Component
 */
function CircularStoryItem({
  video,
  onOpenModal,
  isModalOpen
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

  const videoUrl = video.video?.url ? getMediaUrl(video.video.url) : '';
  const posterUrl = video.video?.thumbnailUrl
    ? getMediaUrl(video.video.thumbnailUrl)
    : videoUrl;

  useEffect(() => {
    const handleVisibility = () => {
      setIsTabHidden(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

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

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || hasVideoError || !videoUrl) return;

    let isDisposed = false;
    vid.muted = true;
    vid.defaultMuted = true;

    const syncPlayback = async () => {
      const shouldPlay = isInViewport && !isTabHidden && !isModalOpen;

      if (shouldPlay) {
        try {
          vid.muted = true;
          const playPromise = vid.play();
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
        if (!vid.paused) {
          vid.pause();
          if (!isDisposed) setIsPlaying(false);
        }
      }
    };

    syncPlayback();

    return () => {
      isDisposed = true;
      if (vid && !vid.paused) {
        vid.pause();
      }
    };
  }, [isInViewport, isTabHidden, isModalOpen, hasVideoError, videoUrl]);

  const displayName = video.customerName || video.displayName || 'Creator';
  const isInfluencer = video.isInfluencer === true;
  const isVerified = video.isVerifiedPurchase === true;

  return (
    <div
      ref={itemRef}
      className={`video-story-item ${isPlaying ? 'is-playing' : ''}`}
      role="listitem"
      onClick={onOpenModal}
      tabIndex={0}
      aria-label={`Watch try-on showcase by ${displayName}`}
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
        title={`Watch ${displayName}'s try-on`}
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
              alt={`Try-on look by ${displayName}`}
              className="video-story-avatar"
              loading="lazy"
              onError={handleImageError}
            />
          )}
        </div>

        {/* Small Play Icon Overlay Badge */}
        <div
          className={`video-story-play-badge ${isPlaying ? 'minimized' : ''} ${isAutoplayBlocked ? 'blocked-fallback' : ''}`}
          aria-hidden={isPlaying}
          title={isAutoplayBlocked ? 'Tap to play video' : undefined}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6 3 20 12 6 21 6 3"></polygon>
          </svg>
        </div>

        {/* Live motion pulse dot when video is active */}
        {isPlaying && (
          <span className="story-live-motion-dot" title="Video playing" aria-hidden="true" />
        )}
      </div>

      {/* Name and Label Underneath */}
      <div className="video-story-meta">
        <span className="video-story-name" title={displayName}>
          {displayName}
        </span>
        {isInfluencer ? (
          <span className="video-story-label influencer" title={video.influencerHandle || 'Influencer'}>
            ✦ {video.influencerHandle || 'Influencer'}
          </span>
        ) : isVerified ? (
          <span className="video-story-label verified" title="Verified Patron">
            ✓ Verified Patron
          </span>
        ) : (
          <span className="video-story-label patron" title="Try-On Look">
            Try-On Look
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Patron & Influencer Try-Ons Section
 * Horizontal Circular Story Track with Interactive 9:16 Video Player Modal
 */
export default function PatronTryOnsReel({ onProductClick, onNavigate }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState(null);

  // Player controls
  const videoPlayerRef = useRef(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  // Fetch genuine videos from MongoDB via GET /api/videos
  useEffect(() => {
    let isMounted = true;

    async function loadVideos() {
      try {
        setLoading(true);
        const res = await fetch(`${BACKEND_URL}/api/videos`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setVideos(Array.isArray(data.videos) ? data.videos : []);
          }
        }
      } catch (err) {
        console.error('Error loading try-on videos:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadVideos();
    return () => { isMounted = false; };
  }, []);

  // Keyboard navigation (Esc to close, Left/Right for story navigation)
  const activeIndex = useMemo(() => {
    if (!activeVideo) return -1;
    return videos.findIndex((v) => String(v._id) === String(activeVideo._id));
  }, [videos, activeVideo]);

  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex >= 0 && activeIndex < videos.length - 1;

  const handlePrev = () => {
    if (hasPrev) {
      setActiveVideo(videos[activeIndex - 1]);
      setCurrentTime(0);
      setIsVideoPlaying(true);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      setActiveVideo(videos[activeIndex + 1]);
      setCurrentTime(0);
      setIsVideoPlaying(true);
    }
  };

  useEffect(() => {
    if (!activeVideo) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveVideo(null);
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        handlePrev();
      } else if (e.key === 'ArrowRight' && hasNext) {
        handleNext();
      } else if (e.key === ' ' && videoPlayerRef.current) {
        e.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeVideo, hasPrev, hasNext]);

  const togglePlayPause = () => {
    if (!videoPlayerRef.current) return;
    if (videoPlayerRef.current.paused) {
      videoPlayerRef.current.play();
      setIsVideoPlaying(true);
    } else {
      videoPlayerRef.current.pause();
      setIsVideoPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoPlayerRef.current) return;
    const nextMuted = !isVideoMuted;
    videoPlayerRef.current.muted = nextMuted;
    setIsVideoMuted(nextMuted);
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoPlayerRef.current) {
      videoPlayerRef.current.currentTime = val;
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoPlayerRef.current) {
      videoPlayerRef.current.volume = val;
      if (val > 0 && isVideoMuted) {
        videoPlayerRef.current.muted = false;
        setIsVideoMuted(false);
      }
    }
  };

  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleShopProduct = (product) => {
    setActiveVideo(null);
    if (onProductClick && product) {
      onProductClick(product);
    } else if (onNavigate && product?._id) {
      onNavigate('product', null, null, null, product._id);
    }
  };

  // If loading or no genuine videos exist, do not invent dummy videos
  if (!loading && videos.length === 0) {
    return null;
  }

  return (
    <section className="patron-tryons-homepage-section" aria-label="Patron & Influencer Try-Ons">
      <div className="tryons-container">
        
        {/* Section Header */}
        <div className="tryons-section-header">
          <div className="tryons-titles">
            <div className="tryons-eyebrow">
              <span className="live-sparkle">✦</span> STYLE IN MOTION
            </div>
            <h2 className="tryons-title">Patron & Influencer Try-Ons</h2>
            <p className="tryons-subtitle">
              Watch real product drape, fit details, and styling inspirations before you buy.
            </p>
          </div>

          {videos.length > 0 && (
            <div className="tryons-count-pill" id="patron-tryons-count">
              {videos.length} {videos.length === 1 ? 'Look' : 'Looks'}
            </div>
          )}
        </div>

        {/* Horizontal Track of Circular Stories */}
        <div className="tryons-track" role="list" aria-label="Product Try-On Stories">
          {videos.map((vid) => (
            <CircularStoryItem
              key={vid._id}
              video={vid}
              onOpenModal={() => {
                setActiveVideo(vid);
                setCurrentTime(0);
                setIsVideoPlaying(true);
              }}
              isModalOpen={Boolean(activeVideo)}
            />
          ))}
        </div>

      </div>

      {/* Full-Screen 9:16 Video Player Modal */}
      {activeVideo && (
        <div
          className="tryon-modal-overlay"
          onClick={() => setActiveVideo(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Try-on video by ${activeVideo.customerName || 'Creator'}`}
        >
          {/* Previous Button */}
          {videos.length > 1 && (
            <button
              type="button"
              className={`tryon-nav-btn prev ${!hasPrev ? 'disabled' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              disabled={!hasPrev}
              aria-label="Previous look"
              title="Previous look (Left Arrow)"
            >
              ‹
            </button>
          )}

          <div
            className="tryon-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              className="tryon-close-btn"
              onClick={() => setActiveVideo(null)}
              title="Close Video (Esc)"
              aria-label="Close video player"
              id="tryon-close-modal-btn"
            >
              ✕
            </button>

            {/* Video Stage Container */}
            <div className="tryon-video-stage">
              {/* Story Progress Segment Bars */}
              {videos.length > 1 && (
                <div className="tryon-progress-segments">
                  {videos.map((v, idx) => (
                    <div
                      key={v._id || idx}
                      className={`tryon-progress-segment ${idx === activeIndex ? 'active' : idx < activeIndex ? 'completed' : ''}`}
                      onClick={() => {
                        setActiveVideo(v);
                        setCurrentTime(0);
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
                src={getMediaUrl(activeVideo.video?.url)}
                className="tryon-video-element"
                playsInline
                autoPlay
                muted={isVideoMuted}
                loop
                onTimeUpdate={() => {
                  if (videoPlayerRef.current) {
                    setCurrentTime(videoPlayerRef.current.currentTime);
                  }
                }}
                onLoadedMetadata={() => {
                  if (videoPlayerRef.current) {
                    setDuration(videoPlayerRef.current.duration);
                    videoPlayerRef.current.volume = volume;
                  }
                }}
                onClick={togglePlayPause}
              />

              {/* Big Center Play Trigger when Paused */}
              {!isVideoPlaying && (
                <button
                  type="button"
                  className="tryon-center-play-trigger"
                  onClick={togglePlayPause}
                  aria-label="Play video"
                >
                  ▶
                </button>
              )}

              {/* Top Floating Badge Bar */}
              <div className="tryon-top-bar">
                <div className="tryon-badge-wrap">
                  {activeVideo.isInfluencer && (
                    <span className="tryon-influencer-pill">
                      ✦ {activeVideo.influencerHandle || 'Creator Partner'}
                    </span>
                  )}
                  {activeVideo.isVerifiedPurchase && (
                    <span className="tryon-verified-pill">
                      ✓ Verified Patron
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className={`tryon-sound-btn ${!isVideoMuted ? 'active-audio' : ''}`}
                  onClick={toggleMute}
                  title={isVideoMuted ? 'Unmute video' : 'Mute video'}
                  id="tryon-sound-toggle-btn"
                >
                  {isVideoMuted ? (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                        <line x1="23" y1="9" x2="17" y2="15"></line>
                        <line x1="17" y1="9" x2="23" y2="15"></line>
                      </svg>
                      <span>Tap to Unmute</span>
                    </>
                  ) : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                      </svg>
                      <span>Sound On</span>
                    </>
                  )}
                </button>
              </div>

              {/* Bottom Playback Controls */}
              <div className="tryon-bottom-bar">
                <div className="tryon-seekbar-wrap">
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSeek}
                    className="tryon-seekbar-input"
                    aria-label="Seek video playback"
                  />
                </div>

                <div className="tryon-controls-row">
                  <button
                    type="button"
                    className="tryon-play-btn"
                    onClick={togglePlayPause}
                    aria-label={isVideoPlaying ? 'Pause' : 'Play'}
                  >
                    {isVideoPlaying ? '❚❚' : '▶'}
                  </button>

                  <span className="tryon-time-text">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>

                  <div className="tryon-volume-slider-wrap">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isVideoMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="tryon-volume-input"
                      aria-label="Volume"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Video Info & Connected Product Card */}
            <div className="tryon-info-sidebar">
              <div className="tryon-creator-card">
                <div className="tryon-creator-avatar">
                  {(activeVideo.customerName || 'C').charAt(0).toUpperCase()}
                </div>
                <div className="tryon-creator-meta">
                  <h4 className="tryon-creator-name">{activeVideo.customerName || 'Creator'}</h4>
                  {activeVideo.influencerHandle && (
                    <span className="tryon-creator-handle">
                      {activeVideo.influencerHandle.startsWith('@') ? activeVideo.influencerHandle : `@${activeVideo.influencerHandle}`}
                    </span>
                  )}
                </div>
              </div>

              <div className="tryon-review-details">
                <h4 className="tryon-review-heading">{activeVideo.title}</h4>
                <p className="tryon-review-notes">{activeVideo.comment}</p>
              </div>

              {/* Connected Product Card (Requirement 3: Link each video to its correct existing product) */}
              {activeVideo.productId && (
                <div className="tryon-product-card">
                  <div className="tryon-prod-card-top">
                    <img
                      src={normalizeProductImageUrl(activeVideo.productId.image || (Array.isArray(activeVideo.productId.images) && activeVideo.productId.images[0]))}
                      alt={activeVideo.productId.name || activeVideo.productId.title}
                      className="tryon-prod-thumb"
                      onError={handleImageError}
                    />
                    <div className="tryon-prod-info">
                      <span className="tryon-prod-badge">FEATURED IN THIS TRY-ON</span>
                      <h4 className="tryon-prod-name">{activeVideo.productId.name || activeVideo.productId.title}</h4>
                      <div className="tryon-prod-price-row">
                        <span className="tryon-prod-price">₹{activeVideo.productId.price?.toLocaleString('en-IN')}</span>
                        {activeVideo.productId.mrp && activeVideo.productId.mrp > activeVideo.productId.price && (
                          <span className="tryon-prod-mrp">₹{activeVideo.productId.mrp?.toLocaleString('en-IN')}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-shop-tryon-product"
                    onClick={() => handleShopProduct(activeVideo.productId)}
                    id="tryon-shop-product-btn"
                  >
                    <span>Shop This Piece</span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Next Button */}
          {videos.length > 1 && (
            <button
              type="button"
              className={`tryon-nav-btn next ${!hasNext ? 'disabled' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              disabled={!hasNext}
              aria-label="Next look"
              title="Next look (Right Arrow)"
            >
              ›
            </button>
          )}
        </div>
      )}
    </section>
  );
}
