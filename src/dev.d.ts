declare global {
  interface Window {
    /** Solo en desarrollo: siembra pistas falsas en IndexedDB. */
    __x21Seed?: (amount: number) => Promise<number>
  }
}

export {}
