// Performance monitoring utility
const STORAGE_KEY = 'finance_performance_metrics';
const MAX_ENTRIES = 100;

// Get stored metrics
export const getStoredMetrics = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {
      pageLoads: [],
      apiCalls: [],
      errors: [],
      sessions: []
    };
  } catch {
    return { pageLoads: [], apiCalls: [], errors: [], sessions: [] };
  }
};

// Save metrics
const saveMetrics = (metrics) => {
  try {
    // Limit entries to prevent localStorage overflow
    metrics.pageLoads = metrics.pageLoads.slice(-MAX_ENTRIES);
    metrics.apiCalls = metrics.apiCalls.slice(-MAX_ENTRIES);
    metrics.errors = metrics.errors.slice(-MAX_ENTRIES);
    metrics.sessions = metrics.sessions.slice(-MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics));
  } catch (error) {
    console.error('Error saving metrics:', error);
  }
};

// Record page load time
export const recordPageLoad = (pageName, loadTime) => {
  const metrics = getStoredMetrics();
  metrics.pageLoads.push({
    page: pageName,
    time: loadTime,
    timestamp: new Date().toISOString()
  });
  saveMetrics(metrics);
};

// Record API call
export const recordApiCall = (endpoint, duration, success) => {
  const metrics = getStoredMetrics();
  metrics.apiCalls.push({
    endpoint,
    duration,
    success,
    timestamp: new Date().toISOString()
  });
  saveMetrics(metrics);
};

// Record error
export const recordError = (error, context = '') => {
  const metrics = getStoredMetrics();
  metrics.errors.push({
    message: error.message || String(error),
    stack: error.stack || '',
    context,
    timestamp: new Date().toISOString()
  });
  saveMetrics(metrics);
};

// Record session
export const recordSession = (userId, action) => {
  const metrics = getStoredMetrics();
  metrics.sessions.push({
    userId,
    action, // 'login' or 'logout'
    timestamp: new Date().toISOString()
  });
  saveMetrics(metrics);
};

// Clear old metrics (older than 7 days)
export const clearOldMetrics = () => {
  const metrics = getStoredMetrics();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const filterOld = (arr) => arr.filter(item => 
    new Date(item.timestamp) > sevenDaysAgo
  );
  
  metrics.pageLoads = filterOld(metrics.pageLoads);
  metrics.apiCalls = filterOld(metrics.apiCalls);
  metrics.errors = filterOld(metrics.errors);
  metrics.sessions = filterOld(metrics.sessions);
  
  saveMetrics(metrics);
};

// Get performance summary
export const getPerformanceSummary = () => {
  const metrics = getStoredMetrics();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last7Days = new Date(today);
  last7Days.setDate(last7Days.getDate() - 7);
  
  // Filter for today
  const todayPageLoads = metrics.pageLoads.filter(p => 
    new Date(p.timestamp) >= today
  );
  const todayApiCalls = metrics.apiCalls.filter(a => 
    new Date(a.timestamp) >= today
  );
  const todayErrors = metrics.errors.filter(e => 
    new Date(e.timestamp) >= today
  );
  
  // Calculate averages
  const avgPageLoad = todayPageLoads.length > 0
    ? todayPageLoads.reduce((sum, p) => sum + p.time, 0) / todayPageLoads.length
    : 0;
  
  const avgApiResponse = todayApiCalls.length > 0
    ? todayApiCalls.reduce((sum, a) => sum + a.duration, 0) / todayApiCalls.length
    : 0;
  
  const successfulCalls = todayApiCalls.filter(a => a.success).length;
  const errorRate = todayApiCalls.length > 0
    ? ((todayApiCalls.length - successfulCalls) / todayApiCalls.length) * 100
    : 0;
  
  return {
    today: {
      pageLoads: todayPageLoads.length,
      avgPageLoad: Math.round(avgPageLoad),
      apiCalls: todayApiCalls.length,
      avgApiResponse: Math.round(avgApiResponse),
      errors: todayErrors.length,
      errorRate: errorRate.toFixed(1)
    },
    totals: {
      pageLoads: metrics.pageLoads.length,
      apiCalls: metrics.apiCalls.length,
      errors: metrics.errors.length
    }
  };
};

// Get trend data for last 7 days
export const getTrendData = () => {
  const metrics = getStoredMetrics();
  const days = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    
    const dayPageLoads = metrics.pageLoads.filter(p => {
      const t = new Date(p.timestamp);
      return t >= dayStart && t < dayEnd;
    });
    
    const dayApiCalls = metrics.apiCalls.filter(a => {
      const t = new Date(a.timestamp);
      return t >= dayStart && t < dayEnd;
    });
    
    const dayErrors = metrics.errors.filter(e => {
      const t = new Date(e.timestamp);
      return t >= dayStart && t < dayEnd;
    });
    
    const avgLoad = dayPageLoads.length > 0
      ? dayPageLoads.reduce((sum, p) => sum + p.time, 0) / dayPageLoads.length
      : 0;
    
    const avgApi = dayApiCalls.length > 0
      ? dayApiCalls.reduce((sum, a) => sum + a.duration, 0) / dayApiCalls.length
      : 0;
    
    days.push({
      date: dayStart.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
      fullDate: dayStart.toISOString().split('T')[0],
      pageLoads: dayPageLoads.length,
      avgPageLoad: Math.round(avgLoad),
      apiCalls: dayApiCalls.length,
      avgApiResponse: Math.round(avgApi),
      errors: dayErrors.length
    });
  }
  
  return days;
};

// Get recent errors
export const getRecentErrors = (limit = 10) => {
  const metrics = getStoredMetrics();
  return metrics.errors
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
};

// Get memory usage (if available)
export const getMemoryUsage = () => {
  if (performance.memory) {
    return {
      usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
      totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
      jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
    };
  }
  return null;
};

// Get current page load metrics
export const getCurrentPageMetrics = () => {
  const navigation = performance.getEntriesByType('navigation')[0];
  if (navigation) {
    const now = performance.now();
    return {
      dns: Math.max(0, Math.round(navigation.domainLookupEnd - navigation.domainLookupStart)),
      tcp: Math.max(0, Math.round(navigation.connectEnd - navigation.connectStart)),
      ttfb: Math.max(0, Math.round(navigation.responseStart - navigation.requestStart)),
      download: Math.max(0, Math.round(navigation.responseEnd - navigation.responseStart)),
      domReady: Math.max(0, Math.round(navigation.domContentLoadedEventEnd - navigation.startTime)),
      load: navigation.loadEventEnd > 0 
        ? Math.round(navigation.loadEventEnd - navigation.startTime)
        : Math.round(now) // Use current time if page still loading
    };
  }
  // Fallback using performance.timing (deprecated but more compatible)
  const timing = performance.timing;
  if (timing && timing.navigationStart) {
    const now = Date.now();
    return {
      dns: Math.max(0, timing.domainLookupEnd - timing.domainLookupStart),
      tcp: Math.max(0, timing.connectEnd - timing.connectStart),
      ttfb: Math.max(0, timing.responseStart - timing.requestStart),
      download: Math.max(0, timing.responseEnd - timing.responseStart),
      domReady: Math.max(0, timing.domContentLoadedEventEnd - timing.navigationStart),
      load: timing.loadEventEnd > 0 
        ? timing.loadEventEnd - timing.navigationStart
        : now - timing.navigationStart
    };
  }
  return null;
};

// Clear all metrics
export const clearAllMetrics = () => {
  localStorage.removeItem(STORAGE_KEY);
};

// Initialize performance monitoring
export const initPerformanceMonitor = () => {
  // Clear old metrics on startup
  clearOldMetrics();
  
  // Record page load when fully loaded
  window.addEventListener('load', () => {
    const pageMetrics = getCurrentPageMetrics();
    if (pageMetrics) {
      recordPageLoad(window.location.pathname, pageMetrics.load);
    }
  });
  
  // Global error handler
  window.addEventListener('error', (event) => {
    recordError({
      message: event.message,
      stack: event.error?.stack || ''
    }, `${event.filename}:${event.lineno}`);
  });
  
  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    recordError({
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack || ''
    }, 'Unhandled Promise Rejection');
  });
};
