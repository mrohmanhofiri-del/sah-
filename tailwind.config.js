/** Hanya index.html yang memakai kelas Tailwind (termasuk di dalam string JS). */
module.exports = {
  content: ['./index.html'],
  theme: {
    extend: {
      colors: {
        // Hijau pinus yang lebih dalam dan tenang; menggantikan emerald bawaan di seluruh aplikasi.
        emerald: { 50: '#eef6f3', 100: '#d9ebe5', 200: '#b3d6cb', 300: '#82bcac', 400: '#4a9c86', 500: '#1f8068', 600: '#0f6b57', 700: '#0b5646', 800: '#0a4538', 900: '#08352c', 950: '#04211b' }
      }
    }
  },
  plugins: []
};
