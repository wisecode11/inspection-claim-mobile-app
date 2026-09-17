const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// lucide-react-native ships ESM (.mjs) files; Metro doesn't resolve that
// extension by default.
config.resolver.sourceExts.push('mjs');

module.exports = config;
