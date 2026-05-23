'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const nav = [
  { href: '/swipe', label: 'Swipe' },
  { href: '/applications', label: 'Applications' },
  { href: '/resume', label: 'Resume' },
  { href: '/resume-versions', label: 'Versions' },
  { href: '/import', label: 'Import' },
  { href: '/scoring', label: 'Scoring' },
  { href: '/dashboard', label: 'Dashboard' },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto">
      {nav.map((n) => {
        const active = pathname === n.href || pathname?.startsWith(n.href + '/');
        return (
          <Link
            key={n.href}
            href={n.href}
            className={
              'rounded-md px-3 py-1.5 text-sm transition-colors duration-150 ' +
              (active
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-ink/70 hover:bg-ink/[0.05] hover:text-ink')
            }
            style={{ transitionTimingFunction: 'var(--ease-out)' }}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
