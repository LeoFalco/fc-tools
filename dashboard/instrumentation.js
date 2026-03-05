export async function register () {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { refreshAll } = await import('./lib/cache.js')

    // Pre-warm cache on server start
    console.log('[cache] Pre-warming cache...')
    refreshAll().then(() => console.log('[cache] Pre-warm complete'))

    // Refresh every 5 minutes
    setInterval(() => {
      console.log('[cache] Refreshing cache...')
      refreshAll().then(() => console.log('[cache] Refresh complete'))
    }, 5 * 60 * 1000)
  }
}
