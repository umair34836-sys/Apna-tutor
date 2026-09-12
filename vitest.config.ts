import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Emulator ke saath baat karte hain — default 5s kam par jata hai.
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
