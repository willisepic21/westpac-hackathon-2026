// Lets Node import .md files as a default-exported string, matching md-transformer.js in Metro.
// Uses module.register() (Node >= 20.6) rather than registerHooks(), which needs Node >= 22.15.
import { register } from 'node:module';

register('./md-hooks.mjs', import.meta.url);
