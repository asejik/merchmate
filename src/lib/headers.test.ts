import { describe, expect, it } from 'vitest';
import vercelConfig from '../../vercel.json?raw';

interface Header { key: string; value: string }

const config = JSON.parse(vercelConfig) as { headers: { source: string; headers: Header[] }[] };
const headers = new Map(config.headers.find(h => h.source === '/(.*)')!.headers.map(h => [h.key, h.value]));
const csp = new Map((headers.get('Content-Security-Policy') ?? '').split(';').map(part => {
  const [name, ...sources] = part.trim().split(/\s+/);
  return [name, sources] as const;
}));

describe('security headers (vercel.json)', () => {
  it('sends every header on every page', () => {
    for (const name of ['Content-Security-Policy', 'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy']) {
      expect(headers.has(name), name).toBe(true);
    }
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('only runs scripts from the app itself, never inline or eval', () => {
    const scripts = csp.get('script-src') ?? [];
    expect(scripts).toContain("'self'");
    // 'wasm-unsafe-eval' is needed by the PDF layout engine and allows WebAssembly only, not eval()
    expect(scripts.filter(s => s !== "'self'")).toEqual(["'wasm-unsafe-eval'"]);
  });

  it('forbids plugins, framing, and base-tag hijacking', () => {
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
    expect(csp.get('base-uri')).toEqual(["'self'"]);
    expect(csp.get('default-src')).toEqual(["'self'"]);
  });

  it('never allows other websites to load content or receive requests', () => {
    // The app makes no network calls to other sites, so no directive should name one
    for (const [name, sources] of csp) {
      expect(sources.filter(s => /^(\*|https?:)/.test(s)), name).toEqual([]);
    }
  });
});

describe('cache headers (vercel.json)', () => {
  const rule = (source: string) => config.headers.find(h => h.source === source)?.headers.find(h => h.key === 'Cache-Control')?.value;

  it('lets the browser keep the hashed build files for a year, without asking again', () => {
    // Every file in /assets has its content hash in its name, so a changed file is a new address
    expect(rule('/assets/(.*)')).toBe('public, max-age=31536000, immutable');
  });

  it('never caches the pages or the service worker that decide which build to load', () => {
    for (const source of ['/(.*)', '/sw.js', '/index.html']) {
      expect(rule(source) ?? '', source).not.toMatch(/immutable|max-age=[1-9]/);
    }
  });
});
