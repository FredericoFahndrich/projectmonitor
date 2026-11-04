export function pollVisible(task, onError) {
  let stopped = false,
    running = false,
    timer,
    delay = 5000;
  async function tick() {
    clearTimeout(timer);
    if (stopped) return;
    if (document.hidden || running) {
      timer = setTimeout(tick, delay);
      return;
    }
    running = true;
    try {
      await task();
      delay = 5000;
    } catch (error) {
      delay = Math.min(60000, delay * 2);
      if (!stopped) onError(error);
    } finally {
      running = false;
      if (!stopped) timer = setTimeout(tick, delay);
    }
  }
  const visible = () => {
    if (!document.hidden) tick();
  };
  document.addEventListener("visibilitychange", visible);
  timer = setTimeout(tick, delay);
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", visible);
  };
}
