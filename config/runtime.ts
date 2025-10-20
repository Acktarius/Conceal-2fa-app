import Constants from 'expo-constants';

// Type definitions for our runtime configuration
interface ConcealConfig {
  defaultNodeUrl: string;
  fallbackNodeUrl: string;
  messageTxAmount: string;
  defaultMixin: number;
  coinUnitPlaces: number;
  debugMode: boolean;
}

interface RuntimeConfig {
  conceal: ConcealConfig;
  debugMode: boolean;
  apiUrl?: string;
}

/**
 * Get runtime configuration from expo-constants
 * This allows access to environment-specific settings defined in app.config.ts
 */
export const getRuntimeConfig = (): RuntimeConfig => {
  const extra = Constants.expoConfig?.extra || {};

  return {
    conceal: {
      defaultNodeUrl: extra.conceal?.defaultNodeUrl || 'https://explorer.conceal.network/',
      fallbackNodeUrl: extra.conceal?.fallbackNodeUrl || 'https://ccxapi.conceal.network/',
      messageTxAmount: extra.conceal?.messageTxAmount || '1000000000',
      defaultMixin: extra.conceal?.defaultMixin || 5,
      coinUnitPlaces: extra.conceal?.coinUnitPlaces || 6,
      debugMode: extra.conceal?.debugMode || false,
    },
    debugMode: extra.debugMode || false,
    apiUrl: extra.apiUrl,
  };
};

/**
 * Get Conceal-specific configuration
 */
export const getConcealConfig = (): ConcealConfig => {
  return getRuntimeConfig().conceal;
};

/**
 * Check if running in debug mode
 */
export const isDebugMode = (): boolean => {
  return getRuntimeConfig().debugMode;
};

/**
 * Get the appropriate node URL based on environment
 */
export const getNodeUrl = (): string => {
  const config = getConcealConfig();
  return config.debugMode ? config.fallbackNodeUrl : config.defaultNodeUrl;
};

/**
 * Log configuration info (only in debug mode)
 */
export const logConfigInfo = (): void => {
  if (isDebugMode()) {
    const config = getRuntimeConfig();
    console.log('Runtime Configuration:', {
      conceal: config.conceal,
      debugMode: config.debugMode,
      apiUrl: config.apiUrl,
      nodeUrl: getNodeUrl(),
    });
  }
};

// Export the config for direct access if needed
export const runtimeConfig = getRuntimeConfig();
export const concealConfig = getConcealConfig();
