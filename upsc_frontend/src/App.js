import React, { useState, useEffect, useRef } from 'react';
import { Search, RefreshCw, Volume2, BookOpen, Calendar, ExternalLink, TrendingUp, Loader2, AlertCircle, X, ChevronDown, LogOut, User as UserIcon, Pause, Play } from 'lucide-react';
import LoginPage from './LoginPage';
import SignupPage from './SignupPage';

const API_BASE_URL = 'https://your-app.onrender.com';

const App = () => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [authView, setAuthView] = useState('login'); // 'login' | 'signup'

  // App state
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [audioLoading, setAudioLoading] = useState({});
  const [audioObjects, setAudioObjects] = useState({}); // Store audio objects for pause/resume
  const [audioUrls, setAudioUrls] = useState({}); // Store audio URLs for cleanup
  const [playingAudioId, setPlayingAudioId] = useState(null); // Track which audio is playing
  const audioObjectsRef = useRef({}); // Ref to track audio objects for cleanup
  const audioUrlsRef = useRef({}); // Ref to track audio URLs for cleanup
  const [fetchingNews, setFetchingNews] = useState(false);
  const [notification, setNotification] = useState(null);
  const [expandedArticles, setExpandedArticles] = useState({});
  const [crispSummaries, setCrispSummaries] = useState({});
  const [crispLoading, setCrispLoading] = useState({});
  const [activeView, setActiveView] = useState('news'); // 'news' | 'summarizer'
  const [customText, setCustomText] = useState('');
  const [customSummary, setCustomSummary] = useState('');
  const [customLoading, setCustomLoading] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Fetch articles only if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchArticles();
    }
  }, [isAuthenticated]);

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/check`, {
        credentials: 'include',
      });
      const data = await response.json();
      
      if (data.status === 'authenticated' && data.user) {
        setIsAuthenticated(true);
        setCurrentUser(data.user);
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    } catch (err) {
      setIsAuthenticated(false);
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = (user) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    setAuthView('login');
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      setIsAuthenticated(false);
      setCurrentUser(null);
      showNotification('Logged out successfully', 'success');
    } catch (err) {
      showNotification('Logout failed', 'error');
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchArticles = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/news`);
      const data = await response.json();
      setArticles(data.articles || []);
      showNotification('Articles loaded successfully!');
    } catch (err) {
      setError('Failed to connect to backend. Make sure it\'s running on port 5000.');
      showNotification('Failed to load articles', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchNewArticles = async () => {
    try {
      setFetchingNews(true);
      const response = await fetch(`${API_BASE_URL}/fetch`, {
        method: 'POST',
      });
      const data = await response.json();
      showNotification(`Fetched ${data.new_articles} new articles!`);
      await fetchArticles();
    } catch (err) {
      showNotification('Failed to fetch new articles', 'error');
    } finally {
      setFetchingNews(false);
    }
  };

  const searchArticles = async () => {
    if (!searchQuery.trim()) {
      fetchArticles();
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/news/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setArticles(data.results || []);
      showNotification(`Found ${data.count} articles`);
    } catch (err) {
      showNotification('Search failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const playAudio = async (articleId) => {
    try {
      // If audio is already loaded and paused, resume it
      if (audioObjects[articleId] && audioObjects[articleId].paused) {
        audioObjects[articleId].play();
        setPlayingAudioId(articleId);
        showNotification('Resuming audio summary');
        return;
      }

      // If different audio is playing, pause it first
      if (playingAudioId && playingAudioId !== articleId && audioObjects[playingAudioId]) {
        audioObjects[playingAudioId].pause();
        setPlayingAudioId(null);
      }

      setAudioLoading(prev => ({ ...prev, [articleId]: true }));
      const response = await fetch(`${API_BASE_URL}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: articleId }),
      });
      
      if (!response.ok) throw new Error('Failed to generate audio');
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      // Store audio object and URL (both state and ref)
      setAudioObjects(prev => ({ ...prev, [articleId]: audio }));
      setAudioUrls(prev => ({ ...prev, [articleId]: audioUrl }));
      audioObjectsRef.current[articleId] = audio;
      audioUrlsRef.current[articleId] = audioUrl;
      
      // Set up event handlers
      audio.onended = () => {
        setPlayingAudioId(null);
        URL.revokeObjectURL(audioUrl);
        setAudioObjects(prev => {
          const newObj = { ...prev };
          delete newObj[articleId];
          return newObj;
        });
        setAudioUrls(prev => {
          const newUrls = { ...prev };
          delete newUrls[articleId];
          return newUrls;
        });
        // Cleanup refs
        delete audioObjectsRef.current[articleId];
        delete audioUrlsRef.current[articleId];
      };

      audio.onerror = () => {
        showNotification('Error playing audio', 'error');
        setPlayingAudioId(null);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
      setPlayingAudioId(articleId);
      showNotification('Playing audio summary');
    } catch (err) {
      showNotification('Failed to play audio', 'error');
    } finally {
      setAudioLoading(prev => ({ ...prev, [articleId]: false }));
    }
  };

  const pauseAudio = (articleId) => {
    if (audioObjects[articleId] && !audioObjects[articleId].paused) {
      audioObjects[articleId].pause();
      setPlayingAudioId(null);
      showNotification('Audio paused');
    }
  };

  const toggleAudio = (articleId) => {
    if (playingAudioId === articleId) {
      // Currently playing this audio, pause it
      pauseAudio(articleId);
    } else {
      // Not playing or different audio, play/resume this one
      playAudio(articleId);
    }
  };

  // Cleanup audio objects on unmount
  useEffect(() => {
    return () => {
      // Cleanup all audio objects when component unmounts using refs (always current)
      Object.values(audioObjectsRef.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = '';
        }
      });
      Object.values(audioUrlsRef.current).forEach(url => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []); // Empty deps - cleanup on unmount only

  const generateCrispSummary = async (articleId) => {
    try {
      setCrispLoading(prev => ({ ...prev, [articleId]: true }));
      const response = await fetch(`${API_BASE_URL}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: articleId, mode: 'crisp' }),
      });

      const data = await response.json();

      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to generate crisp summary');
      }

      setCrispSummaries(prev => ({
        ...prev,
        [articleId]: {
          text: data.summary,
          stats: data.stats || null,
        },
      }));

      showNotification('Crisp summary generated');
    } catch (err) {
      showNotification('Failed to generate crisp summary', 'error');
    } finally {
      setCrispLoading(prev => ({ ...prev, [articleId]: false }));
    }
  };

  const toggleExpand = (articleId) => {
    setExpandedArticles(prev => ({
      ...prev,
      [articleId]: !prev[articleId]
    }));
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const summarizeCustomText = async () => {
    const text = customText.trim();
    if (!text) {
      showNotification('Please enter some text to summarize', 'error');
      return;
    }

    try {
      setCustomLoading(true);
      setCustomSummary('');

      const response = await fetch(`${API_BASE_URL}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode: 'crisp' }),
      });

      const data = await response.json();

      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to summarize text');
      }

      setCustomSummary(data.summary);
      showNotification('Summary generated');
    } catch (err) {
      showNotification('Failed to generate summary', 'error');
    } finally {
      setCustomLoading(false);
    }
  };

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div style={styles.app}>
        <div style={styles.loadingContainer}>
          <Loader2 size={48} color="#3498DB" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={styles.loadingText}>Loading...</p>
        </div>
      </div>
    );
  }

  // Show login/signup pages if not authenticated
  if (!isAuthenticated) {
    return (
      <div>
        {authView === 'login' ? (
          <LoginPage
            onLogin={handleLogin}
            onSwitchToSignup={() => setAuthView('signup')}
            notification={notification}
            showNotification={showNotification}
          />
        ) : (
          <SignupPage
            onSignup={(user) => {
              showNotification('Account created! Please login.', 'success');
              setTimeout(() => setAuthView('login'), 1500);
            }}
            onSwitchToLogin={() => setAuthView('login')}
            notification={notification}
            showNotification={showNotification}
          />
        )}
        {/* Notification for auth pages */}
        {notification && (
          <div style={{
            ...styles.notification,
            background: notification.type === 'error' ? '#ef4444' : '#10b981'
          }}>
            {notification.message}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.app}>
      {/* Notification */}
      {notification && (
        <div style={{
          ...styles.notification,
          background: notification.type === 'error' ? '#ef4444' : '#10b981'
        }}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContainer}>
          <div style={styles.logoSection}>
            <BookOpen size={32} color="#fff" strokeWidth={2.5} />
            <h1 style={styles.title}>UPSC News Hub</h1>
          </div>
          <div style={styles.headerActions}>
            <button
              onClick={() => setActiveView('news')}
              style={{
                ...styles.navBtn,
                ...(activeView === 'news' ? styles.navBtnActive : {}),
              }}
            >
              News
            </button>
            <button
              onClick={() => setActiveView('summarizer')}
              style={{
                ...styles.navBtn,
                ...(activeView === 'summarizer' ? styles.navBtnActive : {}),
              }}
            >
              Text Summarizer
            </button>
            {activeView === 'news' && (
              <button
                onClick={fetchNewArticles}
                disabled={fetchingNews}
                style={{
                  ...styles.refreshBtn,
                  opacity: fetchingNews ? 0.7 : 1,
                  cursor: fetchingNews ? 'not-allowed' : 'pointer',
                }}
              >
                <RefreshCw
                  size={18}
                  style={{
                    animation: fetchingNews ? 'spin 1s linear infinite' : 'none',
                  }}
                />
                <span>{fetchingNews ? 'Fetching...' : 'Fetch Latest'}</span>
              </button>
            )}
            <div style={styles.userSection}>
              <UserIcon size={18} color="#fff" />
              <span style={styles.usernameText}>{currentUser?.username}</span>
            </div>
            <button
              onClick={handleLogout}
              style={styles.logoutBtn}
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.container}>
          {activeView === 'news' && (
            <>
              {/* Search Bar */}
              <div style={styles.searchContainer}>
                <div style={styles.searchWrapper}>
                  <Search size={20} color="#6b7280" style={styles.searchIcon} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchArticles()}
                    placeholder="Search for articles..."
                    style={styles.searchInput}
                  />
                  <button onClick={searchArticles} style={styles.searchBtn}>
                    Search
                  </button>
                </div>
              </div>

              {/* Stats Bar */}
              {!loading && !error && (
                <div style={styles.statsBar}>
                  <div style={styles.stat}>
                    <TrendingUp size={20} color="#E74C3C" />
                    <span style={styles.statText}>
                      <strong>{articles.length}</strong> Articles
                    </span>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {loading && (
                <div style={styles.loadingContainer}>
                  <Loader2 size={48} color="#3498DB" style={{ animation: 'spin 1s linear infinite' }} />
                  <p style={styles.loadingText}>Loading articles...</p>
                </div>
              )}

              {/* Error State */}
              {error && !loading && (
                <div style={styles.errorContainer}>
                  <AlertCircle size={48} color="#ef4444" />
                  <h3 style={styles.errorTitle}>Connection Error</h3>
                  <p style={styles.errorText}>{error}</p>
                  <button onClick={fetchArticles} style={styles.retryBtn}>
                    Try Again
                  </button>
                </div>
              )}

              {/* Empty State */}
              {!loading && !error && articles.length === 0 && (
                <div style={styles.emptyState}>
                  <BookOpen size={64} color="#d1d5db" />
                  <h3 style={styles.emptyTitle}>No articles found</h3>
                  <p style={styles.emptyText}>Try fetching the latest news or adjusting your search</p>
                </div>
              )}

              {/* Articles Grid */}
              {!loading && !error && articles.length > 0 && (
                <div style={styles.articlesGrid}>
                  {articles.map((article) => (
                    <article key={article.id} style={styles.card}>
                      <div style={styles.cardHeader}>
                        <h2 style={styles.cardTitle}>{article.title}</h2>
                        <div style={styles.cardMeta}>
                          <Calendar size={14} color="#6b7280" />
                          <span style={styles.metaText}>{formatDate(article.date)}</span>
                        </div>
                        {article.topic && (
                          <div style={styles.topicBadge}>
                            {article.topic}
                          </div>
                        )}
                      </div>

                      <div style={styles.cardBody}>
                        {article.summary && (
                          <p style={{
                            ...styles.summary,
                            maxHeight: expandedArticles[article.id] ? 'none' : '4.5em',
                            overflow: 'hidden'
                          }}>
                            {article.summary}
                          </p>
                        )}
                        
                        {article.summary && article.summary.length > 200 && (
                          <button 
                            onClick={() => toggleExpand(article.id)}
                            style={styles.expandBtn}
                          >
                            {expandedArticles[article.id] ? 'Show Less' : 'Read More'}
                            <ChevronDown 
                              size={16} 
                              style={{
                                transform: expandedArticles[article.id] ? 'rotate(180deg)' : 'rotate(0)',
                                transition: 'transform 0.3s ease'
                              }}
                            />
                          </button>
                        )}

                        {crispSummaries[article.id] && (
                          <div style={styles.crispContainer}>
                            <div style={styles.crispHeader}>
                              <span style={styles.crispLabel}>Crisp Summary</span>
                              {crispSummaries[article.id].stats && (
                                <span style={styles.crispStats}>
                                  {crispSummaries[article.id].stats.compression_ratio}% shorter
                                </span>
                              )}
                            </div>
                            <p style={styles.crispText}>
                              {crispSummaries[article.id].text}
                            </p>
                          </div>
                        )}
                      </div>

                      <div style={styles.cardActions}>
                        <button
                          onClick={() => toggleAudio(article.id)}
                          disabled={audioLoading[article.id]}
                          style={{
                            ...styles.actionBtn,
                            ...styles.audioBtn,
                            opacity: audioLoading[article.id] ? 0.6 : 1
                          }}
                        >
                          {audioLoading[article.id] ? (
                            <>
                              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                              <span>Loading...</span>
                            </>
                          ) : playingAudioId === article.id ? (
                            <>
                              <Pause size={16} />
                              <span>Pause</span>
                            </>
                          ) : (
                            <>
                              <Play size={16} />
                              <span>Listen</span>
                            </>
                          )}
                        </button>

                        <a
                          href={article.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={styles.actionBtn}
                        >
                          <ExternalLink size={16} />
                          <span>Read Full</span>
                        </a>
                        <button
                          onClick={() => generateCrispSummary(article.id)}
                          disabled={crispLoading[article.id]}
                          style={{
                            ...styles.actionBtn,
                            ...styles.crispBtn,
                            opacity: crispLoading[article.id] ? 0.6 : 1,
                          }}
                        >
                          {crispLoading[article.id] ? (
                            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <BookOpen size={16} />
                          )}
                          <span>{crispLoading[article.id] ? 'Summarizing...' : 'Crisp Summary'}</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {activeView === 'summarizer' && (
            <div style={styles.summarizerWrapper}>
              <h2 style={styles.summarizerTitle}>Text Summarizer</h2>
              <p style={styles.summarizerSubtitle}>
                Paste any article or notes and get a very short, UPSC-friendly summary.
              </p>

              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Paste your article or notes here..."
                style={styles.summarizerTextarea}
                rows={10}
              />

              <div style={styles.summarizerActions}>
                <button
                  onClick={summarizeCustomText}
                  disabled={customLoading}
                  style={{
                    ...styles.summarizerBtn,
                    opacity: customLoading ? 0.7 : 1,
                    cursor: customLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {customLoading ? (
                    <>
                      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Summarizing...</span>
                    </>
                  ) : (
                    <>
                      <BookOpen size={18} />
                      <span>Generate Short Summary</span>
                    </>
                  )}
                </button>
              </div>

              {customSummary && (
                <div style={styles.summarizerResult}>
                  <h3 style={styles.summarizerResultTitle}>Summary</h3>
                  <p style={styles.summarizerResultText}>{customSummary}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* (Article modal not required for crisp summary feature and has been removed to keep the UI focused) */}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        button:not(:disabled):hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        button:not(:disabled):active {
          transform: translateY(0);
        }
        
        a:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </div>
  );
};

const styles = {
  app: {
    minHeight: '100vh',
    background: '#4A90E2',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  crispContainer: {
    marginTop: '0.75rem',
    padding: '0.75rem 0.75rem',
    borderRadius: '10px',
    background: '#f9fafb',
    border: '1px dashed #e5e7eb',
  },

  crispHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.25rem',
  },

  crispLabel: {
    fontSize: '0.8rem',
    fontWeight: '700',
    color: '#E74C3C',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },

  crispStats: {
    fontSize: '0.75rem',
    color: '#6b7280',
  },

  crispText: {
    fontSize: '0.9rem',
    color: '#374151',
    lineHeight: '1.5',
  },
  
  notification: {
    position: 'fixed',
    top: '2rem',
    right: '2rem',
    padding: '1rem 1.5rem',
    borderRadius: '12px',
    color: '#fff',
    fontWeight: '600',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
    zIndex: 1000,
  },
  
  header: {
    background: '#2C3E50',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  
  headerContainer: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '1.25rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  
  title: {
    color: '#fff',
    fontSize: '1.75rem',
    fontWeight: '700',
    letterSpacing: '-0.5px',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },

  navBtn: {
    padding: '0.6rem 1.1rem',
    borderRadius: '999px',
    border: 'none',
    background: 'rgba(255, 255, 255, 0.18)',
    color: '#e5e7eb',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.25s ease',
  },

  navBtnActive: {
    background: '#f9fafb',
    color: '#1f2937',
  },

  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    background: 'rgba(255, 255, 255, 0.15)',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: '600',
  },

  usernameText: {
    color: '#fff',
  },

  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.75rem',
    background: 'rgba(255, 255, 255, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '12px',
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    background: 'rgba(255, 255, 255, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '0.95rem',
    fontWeight: '600',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
  },
  
  searchContainer: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '2rem 2rem 1rem',
  },
  
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    background: '#fff',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
  },
  
  searchIcon: {
    position: 'absolute',
    left: '1.25rem',
    pointerEvents: 'none',
  },
  
  searchInput: {
    flex: 1,
    padding: '1rem 1rem 1rem 3.5rem',
    border: 'none',
    fontSize: '1rem',
    outline: 'none',
    fontFamily: 'inherit',
  },
  
  searchBtn: {
    padding: '1rem 2rem',
    background: '#E74C3C',
    border: 'none',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  
  main: {
    padding: '1rem 0 3rem',
  },
  
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '0 2rem',
  },
  
  statsBar: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '2rem',
    padding: '1rem',
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
  },
  
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  
  statText: {
    fontSize: '0.95rem',
    color: '#374151',
  },
  
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem',
    gap: '1rem',
  },
  
  loadingText: {
    color: '#fff',
    fontSize: '1.1rem',
    fontWeight: '500',
  },
  
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    background: '#fff',
    borderRadius: '16px',
    textAlign: 'center',
  },
  
  errorTitle: {
    fontSize: '1.5rem',
    color: '#1f2937',
    marginTop: '1rem',
  },
  
  errorText: {
    fontSize: '1rem',
    color: '#6b7280',
    marginTop: '0.5rem',
    maxWidth: '500px',
  },
  
  retryBtn: {
    marginTop: '1.5rem',
    padding: '0.75rem 2rem',
    background: '#E74C3C',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '4rem',
    background: '#fff',
    borderRadius: '16px',
  },
  
  emptyTitle: {
    fontSize: '1.5rem',
    color: '#1f2937',
    marginTop: '1rem',
  },
  
  emptyText: {
    fontSize: '1rem',
    color: '#6b7280',
    marginTop: '0.5rem',
  },
  
  articlesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '1.5rem',
  },
  
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '1.5rem',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    transition: 'all 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  
  cardHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  
  cardTitle: {
    fontSize: '1.15rem',
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: '1.4',
  },
  
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  
  metaText: {
    fontSize: '0.875rem',
    color: '#6b7280',
  },

  topicBadge: {
    alignSelf: 'flex-start',
    marginTop: '0.5rem',
    padding: '0.25rem 0.6rem',
    borderRadius: '999px',
    background: '#F8C471',
    color: '#B9770E',
    fontSize: '0.75rem',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  
  cardBody: {
    flex: 1,
  },
  
  summary: {
    fontSize: '0.95rem',
    color: '#4b5563',
    lineHeight: '1.6',
    transition: 'max-height 0.3s ease',
  },
  
  expandBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    marginTop: '0.5rem',
    padding: '0.5rem 0',
    background: 'none',
    border: 'none',
    color: '#E74C3C',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  
  cardActions: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '0.5rem',
  },
  
  actionBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.75rem',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    background: '#fff',
    color: '#374151',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    textDecoration: 'none',
  },
  
  audioBtn: {
    borderColor: '#3498DB',
    color: '#3498DB',
    background: '#EBF5FB',
  },

  crispBtn: {
    borderColor: '#27AE60',
    color: '#229954',
    background: '#EAFAF1',
  },

  summarizerWrapper: {
    marginTop: '2rem',
    padding: '1.5rem',
    borderRadius: '16px',
    background: 'rgba(255, 255, 255, 0.98)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    maxWidth: '900px',
  },

  summarizerTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#111827',
    marginBottom: '0.5rem',
  },

  summarizerSubtitle: {
    fontSize: '0.95rem',
    color: '#6b7280',
    marginBottom: '1.25rem',
  },

  summarizerTextarea: {
    width: '100%',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    padding: '1rem',
    fontFamily: 'inherit',
    fontSize: '0.95rem',
    resize: 'vertical',
    minHeight: '200px',
    outline: 'none',
  },

  summarizerActions: {
    marginTop: '1rem',
    display: 'flex',
    justifyContent: 'flex-end',
  },

  summarizerBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.9rem 1.5rem',
    borderRadius: '12px',
    border: 'none',
    background: '#E74C3C',
    color: '#fff',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },

  summarizerResult: {
    marginTop: '1.5rem',
    padding: '1rem',
    borderRadius: '12px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
  },

  summarizerResultTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '0.5rem',
  },

  summarizerResultText: {
    fontSize: '0.95rem',
    color: '#374151',
    lineHeight: '1.6',
  },
  
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '2rem',
  },
  
  modal: {
    background: '#fff',
    borderRadius: '24px',
    maxWidth: '700px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    padding: '2rem',
    position: 'relative',
  },
  
  modalClose: {
    position: 'absolute',
    top: '1rem',
    right: '1rem',
    background: '#f3f4f6',
    border: 'none',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  
  modalTitle: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '1rem',
    paddingRight: '3rem',
  },
  
  modalMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#6b7280',
    marginBottom: '1.5rem',
  },
  
  modalContent: {
    marginTop: '1.5rem',
  },
  
  modalSectionTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '1rem',
  },
  
  modalText: {
    fontSize: '1rem',
    color: '#4b5563',
    lineHeight: '1.7',
  },
  
  modalActions: {
    display: 'flex',
    gap: '1rem',
    marginTop: '2rem',
  },
  
  modalActionBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '1rem',
    background: '#E74C3C',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    textDecoration: 'none',
  },
};

export default App;
