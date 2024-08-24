import flowbite from 'flowbite/plugin';

module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
    '"./node_modules/flowbite/**/*.js"',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1D4ED8', // Tailwind's blue-700 for primary actions
        background: '#F9FAFB', // Light gray background color
        text: '#111827', // Dark text color
      },
      spacing: {
        128: '32rem',
      },
      boxShadow: {
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  corePlugins: {
    // Remove the Tailwind CSS preflight styles so it can use Material UI's preflight instead (CssBaseline).
    preflight: false,
  },
  plugins: [
    flowbite
  ],
};
