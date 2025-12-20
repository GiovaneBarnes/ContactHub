/**
 * Performance monitoring utilities
 * Tracks Web Vitals and app-specific metrics
 */

// Web Vitals tracking using native Performance API
export const reportWebVitals = (onPerfEntry?: (metric: any) => void) => {
  if (onPerfEntry && typeof window !== 'undefined' && 'performance' in window) {
    // Use Performance Observer for modern browsers
    if ('PerformanceObserver' in window) {
      try {
        // Track LCP (Largest Contentful Paint)
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          onPerfEntry({
            name: 'LCP',
            value: lastEntry.startTime,
            entryType: 'largest-contentful-paint',
          });
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // Track FID (First Input Delay)
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            onPerfEntry({
              name: 'FID',
              value: (entry as any).processingStart - entry.startTime,
              entryType: 'first-input',
            });
          }
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // Track CLS (Cumulative Layout Shift)
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
              onPerfEntry({
                name: 'CLS',
                value: clsValue,
                entryType: 'layout-shift',
              });
            }
          }
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        // Performance Observer not fully supported
      }
    }
  }
};

// Performance marks for custom tracking
export const perfMark = (name: string) => {
  if (typeof window !== 'undefined' && 'performance' in window) {
    try {
      performance.mark(name);
    } catch (e) {
      // Mark failed
    }
  }
};

export const perfMeasure = (name: string, startMark: string, endMark?: string) => {
  if (typeof window !== 'undefined' && 'performance' in window) {
    try {
      if (endMark) {
        performance.measure(name, startMark, endMark);
      } else {
        performance.measure(name, startMark);
      }
      
      const measure = performance.getEntriesByName(name)[0];
      return measure?.duration;
    } catch (e) {
      // Measure failed
      return 0;
    }
  }
  return 0;
};

// Track page load performance
export const trackPageLoad = () => {
  if (typeof window === 'undefined') return;
  
  window.addEventListener('load', () => {
    setTimeout(() => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      if (perfData) {
        const metrics = {
          dns: perfData.domainLookupEnd - perfData.domainLookupStart,
          tcp: perfData.connectEnd - perfData.connectStart,
          ttfb: perfData.responseStart - perfData.requestStart,
          download: perfData.responseEnd - perfData.responseStart,
          domInteractive: perfData.domInteractive - perfData.fetchStart,
          domComplete: perfData.domComplete - perfData.fetchStart,
          loadComplete: perfData.loadEventEnd - perfData.fetchStart,
        };
        
        console.log('📊 Performance Metrics:', metrics);
      }
    }, 0);
  });
};

// Lazy load images
export const lazyLoadImages = () => {
  if (typeof window === 'undefined') return;
  
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        }
      });
    });
    
    document.querySelectorAll('img[data-src]').forEach((img) => {
      imageObserver.observe(img);
    });
  }
};

// Debounce utility for performance
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle utility for performance
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};
