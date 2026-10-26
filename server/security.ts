import crypto from 'node:crypto';
import type { Express, RequestHandler } from 'express';

const digest = (input: string) => crypto.createHash('sha256').update(input).digest();
const same = (a: string, b: string) => crypto.timingSafeEqual(digest(a), digest(b));
const COOKIE = 'motionforge_session';
const TTL = 7 * 24 * 60 * 60 * 1000;

export const installSecurity = (app: Express, production: boolean) => {
  const password = process.env.STUDIO_PASSWORD || '';
  if (production && password.length < 16)
    throw new Error('Set STUDIO_PASSWORD to at least 16 characters before starting production.');
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'no-store');
    // Player and Remotion use inline styles and blob workers; no remote script execution.
    if (production)
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: data:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; frame-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
    next();
  });
  // Reject browser cross-origin mutations, including login CSRF. Non-browser API clients
  // still need the session cookie. Reverse proxies should preserve Host.
  app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (origin && origin !== (process.env.PUBLIC_ORIGIN || `${req.protocol}://${req.get('host')}`)) {
      return res.status(403).json({ error: 'Cross-origin requests are not allowed.' });
    }
    next();
  });
  const sign = (expires: string) => crypto.createHmac('sha256', password).update(expires).digest('hex');
  const authorized = (cookie: string | undefined) => {
    if (!password) return true;
    const token = cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1);
    if (!token) return false;
    const [expires, signature, extra] = token.split('.');
    return (
      !extra && !!expires && !!signature && Number(expires) > Date.now() && same(signature, sign(expires))
    );
  };
  const limits = new Map<string, { attempts: number; reset: number }>();
  app.get('/api/session', (req, res) =>
    res.json({ authenticated: authorized(req.get('cookie')), protected: !!password }),
  );
  app.post('/api/session', (req, res) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    for (const [key, entry] of limits) if (entry.reset < now) limits.delete(key);
    const entry = limits.get(ip) || { attempts: 0, reset: now + 15 * 60_000 };
    if (entry.attempts >= 10 || limits.size >= 10_000)
      return res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' });
    entry.attempts++;
    limits.set(ip, entry);
    if (typeof req.body?.password !== 'string' || !same(req.body.password, password))
      return res.status(401).json({ error: 'Incorrect workspace password.' });
    limits.delete(ip);
    const expires = String(now + TTL);
    res.cookie(COOKIE, `${expires}.${sign(expires)}`, {
      httpOnly: true,
      sameSite: 'strict',
      secure: req.secure || process.env.PUBLIC_ORIGIN?.startsWith('https://'),
      maxAge: TTL,
      path: '/',
    });
    res.json({ authenticated: true });
  });
  app.delete('/api/session', (_req, res) => {
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ authenticated: false });
  });
  const gate: RequestHandler = (req, res, next) => {
    if (authorized(req.get('cookie'))) return next();
    res.status(401).json({ error: 'Unlock your workspace to continue.' });
  };
  app.use(['/api', '/audio', '/renders'], (req, res, next) =>
    req.originalUrl === '/api/health' ? next() : gate(req, res, next),
  );
};

/** Bounded paid-work concurrency. Prevent a click storm from spending API credit. */
export const workLimiter = (): RequestHandler => {
  let active = 0;
  return (_req, res, next) => {
    if (active >= 2)
      return res.status(429).json({ error: 'Another AI or audio task is running. Wait for it to finish.' });
    active++;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        active--;
      }
    };
    res.once('finish', release);
    // Do not release on disconnect: upstream paid work may still be running.
    res.once('close', () => {
      if (!res.writableFinished) setTimeout(release, 180_000).unref();
    });
    next();
  };
};
