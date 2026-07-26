export const SOUND_STORAGE_KEY = 'henan50k:soundOn';
export const BOMB_SOUND_COOLDOWN_MS = 1600;

export function readSoundPreference(storage) {
  try {
    return storage?.getItem?.(SOUND_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeSoundPreference(storage, enabled) {
  try {
    storage?.setItem?.(SOUND_STORAGE_KEY, enabled ? '1' : '0');
    return true;
  } catch {
    return false;
  }
}

export function getSoundButtonState(soundOn, voiceVersion = 'V2') {
  if (soundOn) {
    return {
      label: `关闭炸弹人声${voiceVersion}`,
      text: `关闭人声${voiceVersion}`,
      pressed: true,
      title: '炸弹人声已开启，点击关闭',
    };
  }
  return {
    label: `开启并测试炸弹人声${voiceVersion}`,
    text: `开启人声${voiceVersion}`,
    pressed: false,
    title: '点击后播放一次测试人声；浏览器允许播放后才会保存为开启',
  };
}

export function getSoundToggleResult({ currentlyOn, playbackSucceeded, voiceVersion = 'V2' }) {
  if (currentlyOn) {
    return {
      enabled: false,
      type: 'dim',
      message: `人声${voiceVersion}已关闭，刷新页面后仍保持关闭。`,
    };
  }
  if (playbackSucceeded) {
    return {
      enabled: true,
      type: 'success',
      message: `人声${voiceVersion}已开启，刷新页面后仍保持开启。`,
    };
  }
  return {
    enabled: false,
    type: 'error',
    message: `浏览器暂时不允许播放人声。请确认手机未静音，再点一次“开启人声${voiceVersion}”。`,
  };
}

export function createPlaybackGate({ cooldownMs = BOMB_SOUND_COOLDOWN_MS, now = () => Date.now() } = {}) {
  let lastPlayedAt = -Infinity;
  return {
    tryStart() {
      const current = now();
      if (current - lastPlayedAt < cooldownMs) return false;
      lastPlayedAt = current;
      return true;
    },
    reset() {
      lastPlayedAt = -Infinity;
    },
  };
}

export function prefersReducedFeedback(matchMedia) {
  try {
    return Boolean(matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  } catch {
    return false;
  }
}
