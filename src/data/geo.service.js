export async function getCurrentPosition(opts = { enableHighAccuracy: true, timeout: 10000 }) {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, opts)
  );
}

/**
 * Monitor geolocation permission state.
 * Immediately calls onGranted/onDenied based on current state,
 * and continues to call them whenever the state changes.
 * Returns a cleanup function.
 */
export function watchLocationPermission({ onGranted, onDenied }) {
  if (!navigator.geolocation) {
    onDenied();
    return () => {};
  }

  let permStatus = null;

  const handleState = (state) => {
    if (state === 'granted') onGranted();
    else if (state === 'denied') onDenied();
  };

  if (navigator.permissions) {
    navigator.permissions.query({ name: 'geolocation' }).then(status => {
      permStatus = status;
      handleState(status.state);
      status.onchange = () => handleState(status.state);
    });
  }

  return () => {
    if (permStatus) permStatus.onchange = null;
  };
}
