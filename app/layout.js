import './globals.css';
import './foundation.css';
import './step2.css';
import './step3.css';

export const metadata = {
  title: 'XZ Recruiter — Hiring Intelligence for Recruitment Agencies',
  description: 'Know who is hiring, why now, and what your recruiters should do next.',
  icons: { icon: '/xzrecruiter-logo.svg' }
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
