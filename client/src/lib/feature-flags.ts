/**
 * Feature Flags for ContactHub
 * Easily toggle features on/off without code changes
 */

export const FEATURE_FLAGS = {
  // SMS is disabled until Twilio toll-free verification completes
  // Expected completion: Dec 23-26, 2025
  // To enable: Set to true and redeploy
  SMS_ENABLED: false,
  
  // Add more flags as needed
  // AI_INSIGHTS_ENABLED: true,
  // GOOGLE_CONTACTS_IMPORT: true,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}
