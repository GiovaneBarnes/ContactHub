import { useCallback } from 'react';
import { metricsService } from '@/lib/metrics';

export function useMetrics() {
  const trackPageView = useCallback((page: string, properties?: Record<string, any>) => {
    metricsService.trackPageView(page, properties);
  }, []);

  const trackFeatureUsage = useCallback((feature: string, properties?: Record<string, any>) => {
    metricsService.trackFeatureUsage(feature, properties);
  }, []);

  const trackUserAction = useCallback((action: string, properties?: Record<string, any>) => {
    metricsService.trackUserEngagement(action, properties);
  }, []);

  const trackContactAction = useCallback((action: 'create' | 'update' | 'delete' | 'import' | 'export', properties?: Record<string, any>) => {
    metricsService.trackContactAction(action, properties);
  }, []);

  const trackGroupAction = useCallback((action: 'create' | 'update' | 'delete' | 'schedule', properties?: Record<string, any>) => {
    metricsService.trackGroupAction(action, properties);
  }, []);

  const trackMessageAction = useCallback((action: 'send' | 'schedule' | 'cancel', properties?: Record<string, any>) => {
    metricsService.trackMessageAction(action, properties);
  }, []);

  const trackAIAction = useCallback((action: 'generate_message' | 'categorize_contact' | 'analyze_communication', properties?: Record<string, any>) => {
    metricsService.trackAIAction(action, properties);
  }, []);

  const trackSystemEvent = useCallback((action: 'page_load' | 'api_call' | 'error', properties?: Record<string, any>) => {
    metricsService.trackSystemAction(action, properties);
  }, []);

  return {
    trackPageView,
    trackFeatureUsage,
    trackUserAction,
    trackContactAction,
    trackGroupAction,
    trackMessageAction,
    trackAIAction,
    trackSystemEvent,
  };
}