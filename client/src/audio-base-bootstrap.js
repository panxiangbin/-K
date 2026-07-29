const installedTargets = new WeakSet();

export function resolveNestedAudioUrl(src, locationObject = globalThis.location) {
  if (!src || !locationObject) return src;
  const hostname = String(locationObject.hostname || '').toLowerCase();
  if (!hostname.endsWith('.github.io')) return src;
  if (!String(src).startsWith('/audio/')) return src;

  const parts = String(locationObject.pathname || '/').split('/').filter(Boolean);
  const projectBase = parts.length >= 2 ? `/${parts[0]}/${parts[1]}/` : '/';
  return `${projectBase}${String(src).replace(/^\//, '')}`;
}

export function installNestedAudioBase(target = globalThis) {
  const NativeAudio = target?.Audio;
  if (typeof NativeAudio !== 'function') return false;
  if (!String(target?.location?.hostname || '').toLowerCase().endsWith('.github.io')) return true;
  if (installedTargets.has(target)) return true;

  try {
    const NestedAudio = new Proxy(NativeAudio, {
      construct(Target, args) {
        const [src, ...rest] = args;
        return new Target(resolveNestedAudioUrl(src, target.location), ...rest);
      },
    });
    target.Audio = NestedAudio;
    if (target.Audio !== NestedAudio) return false;
    installedTargets.add(target);
    return true;
  } catch {
    return false;
  }
}
