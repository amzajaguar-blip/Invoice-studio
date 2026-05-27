export const tokens = {
  colors: {
    // HSL dynamic palette for theming
    primary: { base: 'hsl(221, 83%, 53%)', hover: 'hsl(221, 83%, 45%)' },
    success: { base: 'hsl(142, 71%, 45%)', hover: 'hsl(142, 71%, 38%)' },
    // glassmorphism vars
    glass: { bg: 'rgba(255,255,255,0.1)', border: 'rgba(255,255,255,0.2)', blur: '12px' }
  },
  motion: {
    micro: { duration: '150ms', easing: 'cubic-bezier(0.4,0,0.2,1)' },
    success: { confetti: { particles: 50, spread: 60 } }
  }
} as const;
