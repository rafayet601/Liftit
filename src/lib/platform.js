/**
 * Platform helpers — work in the browser and when running inside Capacitor
 * (iOS/Android). All imports from @capacitor/* are done lazily to keep the
 * web bundle small and to avoid breaking SSR/tests.
 */

let _capPromise = null;
function getCap() {
    if (_capPromise) return _capPromise;
    _capPromise = import('@capacitor/core')
        .then((m) => m.Capacitor)
        .catch(() => null);
    return _capPromise;
}

export async function isNative() {
    const Cap = await getCap();
    return !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());
}

export function isIOSWeb() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
}

export function isStandalone() {
    if (typeof window === 'undefined') return false;
    return (
        window.matchMedia?.('(display-mode: standalone)').matches ||
        window.navigator.standalone === true
    );
}

/** Fire a light haptic. No-op on unsupported platforms. */
export async function hapticLight() {
    try {
        if (await isNative()) {
            const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
            await Haptics.impact({ style: ImpactStyle.Light });
            return;
        }
    } catch {}
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8);
}

export async function hapticMedium() {
    try {
        if (await isNative()) {
            const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
            await Haptics.impact({ style: ImpactStyle.Medium });
            return;
        }
    } catch {}
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(16);
}

export async function hapticSuccess() {
    try {
        if (await isNative()) {
            const { Haptics, NotificationType } = await import('@capacitor/haptics');
            await Haptics.notification({ type: NotificationType.Success });
            return;
        }
    } catch {}
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([10, 40, 10]);
}

export async function hapticSelection() {
    try {
        if (await isNative()) {
            const { Haptics } = await import('@capacitor/haptics');
            await Haptics.selectionStart();
            setTimeout(() => Haptics.selectionEnd().catch(() => {}), 30);
            return;
        }
    } catch {}
}

/**
 * Initialize native iOS polish (status bar, back-button etc). Safe no-op on web.
 */
export async function initNativeShell() {
    if (!(await isNative())) return;
    try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor?.({ color: '#09090b' }).catch(() => {});
        await StatusBar.setOverlaysWebView?.({ overlay: true }).catch(() => {});
    } catch {}
    try {
        const { Keyboard } = await import('@capacitor/keyboard');
        Keyboard.setAccessoryBarVisible?.({ isVisible: false }).catch(() => {});
    } catch {}
}
