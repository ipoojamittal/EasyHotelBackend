// src/polyfills/slow-buffer.ts
// Polyfill: SlowBuffer was removed in Node.js 22+, but some transitive
// dependencies (buffer-equal-constant-time, via jsonwebtoken → jws → jwa)
// still reference require('buffer').SlowBuffer. Without this, they crash
// with "Cannot read properties of undefined (reading 'prototype')" on
// Node 22+. This must be imported before any module that transitively
// loads jsonwebtoken.
const bufferModule = require("buffer");
if (!(bufferModule as any).SlowBuffer) {
  (bufferModule as any).SlowBuffer = bufferModule.Buffer;
}
