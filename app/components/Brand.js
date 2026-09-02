import Image from 'next/image';
import Link from 'next/link';

export default function Brand({ href = '/', compact = false }) {
  const image = <Image
    className="brand-logo"
    src="/xzrecruiter-logo.svg"
    alt="XZ Recruiter"
    width={compact ? 170 : 196}
    height={compact ? 55 : 63}
    priority
    unoptimized
  />;

  return href ? <Link className="brand" href={href} aria-label="XZ Recruiter home">{image}</Link> : <div className="brand" aria-label="XZ Recruiter">{image}</div>;
}
