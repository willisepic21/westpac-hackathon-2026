// Metro config: Expo defaults, plus importing .md files as plain strings
// (used to load ai_perms.md into the assistant's system prompt).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('md');
config.transformer.babelTransformerPath = require.resolve('./md-transformer.js');

module.exports = config;
