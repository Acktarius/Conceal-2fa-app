/**
 * Comprehensive icon service for matching service names to appropriate icons
 * Uses multiple icon families from @expo/vector-icons with fallback logic
 */

export interface IconInfo {
  name: string;
  family: 'Ionicons' | 'MaterialIcons' | 'FontAwesome' | 'AntDesign' | 'Entypo' | 'Feather' | 'MaterialCommunityIcons';
}

export class IconService {
  // Primary icon mappings using Ionicons (most comprehensive)
  private static readonly ioniconsMap: { [key: string]: string } = {
    // Social Media
    'facebook': 'logo-facebook',
    'twitter': 'logo-twitter',
    'instagram': 'logo-instagram',
    'linkedin': 'logo-linkedin',
    'discord': 'logo-discord',
    'telegram': 'paper-plane',
    'whatsapp': 'logo-whatsapp',
    'snapchat': 'logo-snapchat',
    'tiktok': 'musical-notes',
    'youtube': 'logo-youtube',
    'twitch': 'logo-twitch',
    
    // Email & Communication
    'gmail': 'mail',
    'google': 'logo-google',
    'outlook': 'mail',
    'yahoo': 'mail',
    'protonmail': 'mail',
    'icloud': 'cloud',
    
    // Cloud & Storage
    'dropbox': 'cloud',
    'onedrive': 'cloud',
    'google drive': 'cloud',
    'mega': 'cloud',
    
    // Gaming
    'steam': 'game-controller',
    'epic': 'game-controller',
    'origin': 'game-controller',
    'battle.net': 'game-controller',
    'playstation': 'game-controller',
    'xbox': 'game-controller',
    'nintendo': 'game-controller',
    
    // Finance & Crypto
    'paypal': 'card',
    'stripe': 'card',
    'coinbase': 'logo-bitcoin',
    'binance': 'logo-bitcoin',
    'kraken': 'logo-bitcoin',
    'metamask': 'logo-bitcoin',
    'trust wallet': 'logo-bitcoin',
    'bank': 'card',
    'chase': 'card',
    'wells fargo': 'card',
    'bank of america': 'card',
    
    // Development & Tech
    'github': 'logo-github',
    'gitlab': 'logo-github',
    'bitbucket': 'logo-github',
    'aws': 'cloud',
    'azure': 'cloud',
    'heroku': 'cloud',
    'digitalocean': 'cloud',
    'vultr': 'cloud',
    'linode': 'cloud',
    
    // Productivity & Tools
    'slack': 'chatbubbles',
    'teams': 'chatbubbles',
    'zoom': 'videocam',
    'skype': 'videocam',
    'trello': 'list',
    'asana': 'list',
    'notion': 'document',
    'evernote': 'document',
    'onenote': 'document',
    
    // E-commerce
    'amazon': 'storefront',
    'ebay': 'storefront',
    'shopify': 'storefront',
    'etsy': 'storefront',
    
    // Streaming & Media
    'netflix': 'play',
    'spotify': 'musical-notes',
    'hulu': 'play',
    'disney': 'play',
    'hbo': 'play',
    
    // Security & VPN
    'nordvpn': 'shield',
    'expressvpn': 'shield',
    'surfshark': 'shield',
    'protonvpn': 'shield',
    'lastpass': 'key',
    '1password': 'key',
    'bitwarden': 'key',
    'dashlane': 'key',
    
    // Default icons for common patterns
    'vpn': 'shield',
    'password': 'key',
    'auth': 'shield',
    'login': 'log-in',
    'account': 'person',
    'profile': 'person',
    'user': 'person',
    'admin': 'person-circle',
    'api': 'code',
    'web': 'globe',
    'app': 'phone-portrait',
    'mobile': 'phone-portrait',
    'desktop': 'desktop',
    'server': 'server',
    'database': 'server',
    'backup': 'cloud-upload',
    'sync': 'sync',
  };

  // Fallback mappings using MaterialIcons
  private static readonly materialIconsMap: { [key: string]: string } = {
    'facebook': 'facebook',
    'twitter': 'alternate-email',
    'instagram': 'photo-camera',
    'linkedin': 'work',
    'discord': 'chat',
    'telegram': 'send',
    'whatsapp': 'message',
    'snapchat': 'camera-alt',
    'tiktok': 'music-note',
    'youtube': 'play-circle-filled',
    'twitch': 'live-tv',
    'gmail': 'email',
    'google': 'search',
    'outlook': 'email',
    'yahoo': 'email',
    'protonmail': 'email',
    'icloud': 'cloud',
    'dropbox': 'cloud',
    'onedrive': 'cloud',
    'google drive': 'cloud',
    'mega': 'cloud',
    'steam': 'sports-esports',
    'epic': 'sports-esports',
    'origin': 'sports-esports',
    'battle.net': 'sports-esports',
    'playstation': 'sports-esports',
    'xbox': 'sports-esports',
    'nintendo': 'sports-esports',
    'paypal': 'payment',
    'stripe': 'payment',
    'coinbase': 'currency-bitcoin',
    'binance': 'currency-bitcoin',
    'kraken': 'currency-bitcoin',
    'metamask': 'currency-bitcoin',
    'trust wallet': 'currency-bitcoin',
    'bank': 'account-balance',
    'chase': 'account-balance',
    'wells fargo': 'account-balance',
    'bank of america': 'account-balance',
    'github': 'code',
    'gitlab': 'code',
    'bitbucket': 'code',
    'aws': 'cloud',
    'azure': 'cloud',
    'heroku': 'cloud',
    'digitalocean': 'cloud',
    'vultr': 'cloud',
    'linode': 'cloud',
    'slack': 'chat',
    'teams': 'chat',
    'zoom': 'video-call',
    'skype': 'video-call',
    'trello': 'view-list',
    'asana': 'view-list',
    'notion': 'description',
    'evernote': 'description',
    'onenote': 'description',
    'amazon': 'store',
    'ebay': 'store',
    'shopify': 'store',
    'etsy': 'store',
    'netflix': 'play-circle-filled',
    'spotify': 'music-note',
    'hulu': 'play-circle-filled',
    'disney': 'play-circle-filled',
    'hbo': 'play-circle-filled',
    'nordvpn': 'security',
    'expressvpn': 'security',
    'surfshark': 'security',
    'protonvpn': 'security',
    'lastpass': 'vpn-key',
    '1password': 'vpn-key',
    'bitwarden': 'vpn-key',
    'dashlane': 'vpn-key',
    'vpn': 'security',
    'password': 'vpn-key',
    'auth': 'security',
    'login': 'login',
    'account': 'person',
    'profile': 'person',
    'user': 'person',
    'admin': 'admin-panel-settings',
    'api': 'api',
    'web': 'language',
    'app': 'phone-android',
    'mobile': 'phone-android',
    'desktop': 'computer',
    'server': 'dns',
    'database': 'storage',
    'backup': 'cloud-upload',
    'sync': 'sync',
  };

  // FontAwesome fallback mappings
  private static readonly fontAwesomeMap: { [key: string]: string } = {
    'facebook': 'facebook',
    'twitter': 'twitter',
    'instagram': 'instagram',
    'linkedin': 'linkedin',
    'discord': 'discord',
    'telegram': 'telegram',
    'whatsapp': 'whatsapp',
    'snapchat': 'snapchat',
    'tiktok': 'tiktok',
    'youtube': 'youtube',
    'twitch': 'twitch',
    'gmail': 'envelope',
    'google': 'google',
    'outlook': 'envelope',
    'yahoo': 'envelope',
    'protonmail': 'envelope',
    'icloud': 'cloud',
    'dropbox': 'dropbox',
    'onedrive': 'cloud',
    'google drive': 'google-drive',
    'mega': 'cloud',
    'steam': 'steam',
    'epic': 'gamepad',
    'origin': 'gamepad',
    'battle.net': 'gamepad',
    'playstation': 'playstation',
    'xbox': 'xbox',
    'nintendo': 'gamepad',
    'paypal': 'paypal',
    'stripe': 'cc-stripe',
    'coinbase': 'bitcoin',
    'binance': 'bitcoin',
    'kraken': 'bitcoin',
    'metamask': 'bitcoin',
    'trust wallet': 'bitcoin',
    'bank': 'university',
    'chase': 'university',
    'wells fargo': 'university',
    'bank of america': 'university',
    'github': 'github',
    'gitlab': 'gitlab',
    'bitbucket': 'bitbucket',
    'aws': 'aws',
    'azure': 'microsoft',
    'heroku': 'cloud',
    'digitalocean': 'cloud',
    'vultr': 'cloud',
    'linode': 'cloud',
    'slack': 'slack',
    'teams': 'microsoft',
    'zoom': 'video',
    'skype': 'skype',
    'trello': 'trello',
    'asana': 'asana',
    'notion': 'file-alt',
    'evernote': 'evernote',
    'onenote': 'microsoft',
    'amazon': 'amazon',
    'ebay': 'ebay',
    'shopify': 'shopify',
    'etsy': 'etsy',
    'netflix': 'netflix',
    'spotify': 'spotify',
    'hulu': 'hulu',
    'disney': 'disney',
    'hbo': 'hbo',
    'nordvpn': 'shield-alt',
    'expressvpn': 'shield-alt',
    'surfshark': 'shield-alt',
    'protonvpn': 'shield-alt',
    'lastpass': 'key',
    '1password': 'key',
    'bitwarden': 'key',
    'dashlane': 'key',
    'vpn': 'shield-alt',
    'password': 'key',
    'auth': 'shield-alt',
    'login': 'sign-in-alt',
    'account': 'user',
    'profile': 'user',
    'user': 'user',
    'admin': 'user-shield',
    'api': 'code',
    'web': 'globe',
    'app': 'mobile-alt',
    'mobile': 'mobile-alt',
    'desktop': 'desktop',
    'server': 'server',
    'database': 'database',
    'backup': 'cloud-upload-alt',
    'sync': 'sync',
  };

  /**
   * Get the appropriate icon for a service name with fallback logic
   * @param serviceName - The name of the service
   * @param issuerName - Optional issuer name for additional matching
   * @returns IconInfo with name and family
   */
  static getServiceIcon(serviceName: string, issuerName?: string): IconInfo {
    const name = serviceName.toLowerCase();
    const issuer = issuerName?.toLowerCase() || '';
    
    // Helper function to extract the main service name (remove email addresses, etc.)
    const extractMainServiceName = (fullName: string): string => {
      const withoutEmail = fullName.replace(/@.*$/, '');
      // Remove special characters and extra spaces
      const cleaned = withoutEmail.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      // Return only the first word (the service name)
      return cleaned.split(' ')[0];
    };
    
    // Helper function to try matching against icon maps
    const tryMatch = (searchName: string): IconInfo | null => {
      // Try exact match first
      if (this.ioniconsMap[searchName]) {
        return {
          name: this.ioniconsMap[searchName],
          family: 'Ionicons'
        };
      }
      
      // Try partial matches in Ionicons
      for (const [key, icon] of Object.entries(this.ioniconsMap)) {
        if (searchName.includes(key) || key.includes(searchName)) {
          return {
            name: icon,
            family: 'Ionicons'
          };
        }
      }
      
      // Try MaterialIcons as fallback
      if (this.materialIconsMap[searchName]) {
        return {
          name: this.materialIconsMap[searchName],
          family: 'MaterialIcons'
        };
      }
      
      // Try partial matches in MaterialIcons
      for (const [key, icon] of Object.entries(this.materialIconsMap)) {
        if (searchName.includes(key) || key.includes(searchName)) {
          return {
            name: icon,
            family: 'MaterialIcons'
          };
        }
      }
      
      // Try FontAwesome as final fallback
      if (this.fontAwesomeMap[searchName]) {
        return {
          name: this.fontAwesomeMap[searchName],
          family: 'FontAwesome'
        };
      }
      
      // Try partial matches in FontAwesome
      for (const [key, icon] of Object.entries(this.fontAwesomeMap)) {
        if (searchName.includes(key) || key.includes(searchName)) {
          return {
            name: icon,
            family: 'FontAwesome'
          };
        }
      }
      
      return null;
    };
    
    // Step 1: Try exact service name match
    let result = tryMatch(name);
    if (result) return result;
    
    // Step 2: Try cleaned service name (remove email addresses, etc.)
    const cleanedServiceName = extractMainServiceName(name);
    if (cleanedServiceName !== name) {
      result = tryMatch(cleanedServiceName);
      if (result) return result;
    }
    
    // Step 3: Try issuer name if provided
    if (issuer && issuer !== name) {
      result = tryMatch(issuer);
      if (result) return result;
      
      // Try cleaned issuer name
      const cleanedIssuerName = extractMainServiceName(issuer);
      if (cleanedIssuerName !== issuer) {
        result = tryMatch(cleanedIssuerName);
        if (result) return result;
      }
    }
    
    // Step 4: Try individual words from service name
    const words = cleanedServiceName.split(' ').filter(word => word.length > 2);
    for (const word of words) {
      result = tryMatch(word);
      if (result) return result;
    }
    
    // Step 5: Try individual words from issuer name
    if (issuer) {
      const issuerWords = extractMainServiceName(issuer).split(' ').filter(word => word.length > 2);
      for (const word of issuerWords) {
        result = tryMatch(word);
        if (result) return result;
      }
    }
    
    // Default fallback
    return {
      name: 'shield',
      family: 'Ionicons'
    };
  }

  /**
   * Get all available service icons from a specific family
   * @param family - The icon family
   * @returns Array of icon names
   */
  static getIconsByFamily(family: 'Ionicons' | 'MaterialIcons' | 'FontAwesome'): string[] {
    switch (family) {
      case 'Ionicons':
        return Object.values(this.ioniconsMap);
      case 'MaterialIcons':
        return Object.values(this.materialIconsMap);
      case 'FontAwesome':
        return Object.values(this.fontAwesomeMap);
      default:
        return [];
    }
  }

  /**
   * Get all available service names that have icons
   * @returns Array of all service names
   */
  static getAllServiceNames(): string[] {
    const allNames = new Set([
      ...Object.keys(this.ioniconsMap),
      ...Object.keys(this.materialIconsMap),
      ...Object.keys(this.fontAwesomeMap)
    ]);
    return Array.from(allNames);
  }

  /**
   * Check if a service has a specific icon
   * @param serviceName - The name of the service
   * @returns True if the service has an icon mapping
   */
  static hasIcon(serviceName: string): boolean {
    const name = serviceName.toLowerCase();
    return this.ioniconsMap[name] !== undefined || 
           this.materialIconsMap[name] !== undefined || 
           this.fontAwesomeMap[name] !== undefined;
  }
}
