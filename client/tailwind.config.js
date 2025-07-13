module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Dynamic conditional classes
    'text-green-600',
    'text-yellow-600', 
    'text-red-600',
    'text-orange-600',
    'text-blue-600',
    'text-gray-600',
    'text-gray-500',
    'text-gray-400',
    'text-gray-900',
    'text-gray-800',
    'text-gray-700',
    'text-gray-300',
    'text-white',
    'text-black',
    'text-purple-600',
    'text-red-700',
    'text-red-800',
    'text-green-700',
    'text-green-800',
    'text-yellow-800',
    'text-blue-700',
    'text-blue-800',
    'text-blue-900',
    'text-blue-400',
    'text-orange-800',
    
    // Background colors
    'bg-green-100',
    'bg-yellow-100',
    'bg-red-100',
    'bg-orange-100',
    'bg-blue-100',
    'bg-gray-100',
    'bg-gray-200',
    'bg-gray-300',
    'bg-gray-50',
    'bg-white',
    'bg-red-200',
    'bg-red-300',
    'bg-green-50',
    'bg-blue-50',
    'bg-orange-200',
    'bg-pink-50',
    'bg-red-50',
    'bg-yellow-50',
    
    // Border colors
    'border-red-200',
    'border-gray-200',
    'border-gray-300',
    'border-gray-100',
    'border-white',
    'border-transparent',
    'border-t-transparent',
    
    // Opacity classes
    'opacity-60',
    'opacity-50',
    'opacity-70',
    'opacity-90',
    'opacity-100',
    
    // Gradient classes
    'bg-gradient-to-r',
    'from-red-50',
    'to-pink-50',
    'from-blue-100',
    'to-blue-50',
    'from-green-100',
    'to-green-200',
    'from-orange-100',
    'to-orange-200',
    'from-yellow-500',
    'to-yellow-600',
    'from-red-500',
    'to-red-600',
    'from-slate-50',
    'to-pink-50',
    'to-blue-200',
    'to-blue-600',
    'to-red-600',
    'to-yellow-600',
    
    // Status-based classes
    'bg-green-100',
    'text-green-800',
    'bg-yellow-100', 
    'text-yellow-800',
    'bg-red-100',
    'text-red-800',
    'bg-blue-100',
    'text-blue-800',
    'bg-gray-100',
    'text-gray-800',
    
    // Interactive states
    'hover:bg-gray-50',
    'hover:bg-gray-100',
    'hover:bg-gray-200',
    'hover:bg-gray-300',
    'hover:bg-red-100',
    'hover:bg-red-50',
    'hover:bg-red-600',
    'hover:bg-red-700',
    'hover:bg-green-100',
    'hover:bg-green-700',
    'hover:bg-blue-700',
    'hover:bg-white',
    'hover:text-gray-500',
    'hover:text-gray-600',
    'hover:text-gray-700',
    'hover:text-gray-800',
    'hover:text-gray-900',
    'hover:text-red-700',
    'hover:text-red-800',
    'hover:text-blue-800',
    'hover:border-gray-200',
    'hover:border-gray-300',
    'hover:opacity-90',
    'hover:opacity-100',
    'hover:shadow-md',
    'hover:shadow-lg',
    'hover:shadow-xl',
    
    // Focus states
    'focus:ring-blue-500',
    'focus:ring-green-500',
    'focus:ring-orange-500',
    'focus:ring-red-500',
    'focus:ring-ring',
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-offset-2',
    'focus:bg-accent',
    'focus:text-accent-foreground',
    'focus:border-blue-500',
    
    // Focus-visible states
    'focus-visible:outline-none',
    'focus-visible:ring-2',
    'focus-visible:ring-blue-500',
    'focus-visible:ring-ring',
    'focus-visible:ring-offset-2',
    
    // Disabled states
    'disabled:pointer-events-none',
    'disabled:cursor-not-allowed',
    'disabled:opacity-50',
    'peer-disabled:cursor-not-allowed',
    'peer-disabled:opacity-70',
    
    // Data attributes
    'data-[disabled]:pointer-events-none',
    'data-[disabled]:opacity-50',
    'data-[side=bottom]:translate-y-1',
    'data-[side=left]:-translate-x-1',
    'data-[side=right]:translate-x-1',
    'data-[side=top]:-translate-y-1',
    
    // Group hover states
    'group-hover:text-gray-500',
    'group-hover:shadow-sm',
    
    // File selector button styles
    'file:border-0',
    'file:bg-transparent',
    'file:text-sm',
    'file:font-medium',
    'file:text-foreground',
    
    // Placeholder styles
    'placeholder:text-muted-foreground',
    
    // Last child styles
    'last:border-b-0',
    
    // Line clamp
    '[&>span]:line-clamp-1'
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    }
  },
  plugins: []
}; 