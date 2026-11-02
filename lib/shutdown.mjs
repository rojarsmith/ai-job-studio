// Cleanup that must run before a script exits. A script that attached to your Chrome keeps Node's event loop alive through the
// debugging connection, so `beforeExit` never fires and tabs it opened would stay open (and the process would never end).
// Code that opens a tab registers a closer with onShutdown(); the script's last lines are `await shutdown(); process.exit(0)`.
const hooks = [];

export const onShutdown = (fn) => { hooks.push(fn); };

/** Run the registered closers, last registered first; one failing closer does not stop the others. */
export async function shutdown() {
  for (const fn of hooks.splice(0).reverse()) {
    try { await fn(); } catch { /* the tab or browser may already be gone */ }
  }
}
