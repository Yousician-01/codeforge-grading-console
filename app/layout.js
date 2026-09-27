import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import './globals.css';

export const metadata = {
  title: 'Gradecraft — A clearer way to grade',
  description: 'Import marks, understand your class, and finalize grades with confidence. A CodeForge project.'
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
