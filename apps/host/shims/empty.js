// Empty shim for Node builtins pulled in by server-oriented deps
// (@anthropic-ai/sdk credential helpers import node:fs but never run on device).
module.exports = {};
