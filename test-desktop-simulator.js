#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('\n═══════════════════════════════════════════════════════════');
console.log('    Desktop Simulator Test Runner');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('Starting desktop simulator...\n');
console.log('Press Ctrl+C to stop\n');
console.log('───────────────────────────────────────────────────────────\n');

// Run the desktop simulator
const simulator = spawn('node', [path.join(__dirname, 'server', 'desktop-simulator.js')], {
  stdio: 'inherit',
  env: process.env
});

// Handle errors
simulator.on('error', (err) => {
  console.error('Failed to start desktop simulator:', err);
  process.exit(1);
});

// Handle exit
simulator.on('exit', (code) => {
  console.log(`\nDesktop simulator exited with code ${code}`);
  process.exit(code);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\nStopping desktop simulator...');
  simulator.kill('SIGINT');
});

process.on('SIGTERM', () => {
  simulator.kill('SIGTERM');
});