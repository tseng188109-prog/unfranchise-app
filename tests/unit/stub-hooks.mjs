const map = {
  '@supabase/supabase-js': new URL('./stubs/@supabase/supabase-js/index.js', import.meta.url).href,
  'web-push': new URL('./stubs/web-push/index.js', import.meta.url).href,
}
export async function resolve(spec, ctx, next) {
  if (map[spec]) return { url: map[spec], shortCircuit: true }
  return next(spec, ctx)
}
