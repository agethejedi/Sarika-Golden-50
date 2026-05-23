/**
 * Sarika Golden 50 — Cloudflare Worker Backend
 *
 * Bindings required (Cloudflare Dashboard → Worker → Settings → Bindings):
 *   DB       → D1 database
 *   BUCKET   → R2 bucket
 *
 * Secrets (Cloudflare Dashboard → Worker → Settings → Variables → Encrypted):
 *   ADMIN_PASSWORD
 *   SARIKA_PASSWORD
 *   JWT_SECRET
 *   ANTHROPIC_API_KEY
 */

// ── JWT via built-in Web Crypto (no imports needed) ──────────────────────

async function signJWT(payload, secret) {
  var enc = function(obj) {
    return btoa(JSON.stringify(obj))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
  }
  var header = { alg: 'HS256', typ: 'JWT' }
  var data = enc(header) + '.' + enc(payload)
  var key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  var sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  var sigB64 = btoa(String.fromCharCode.apply(null, new Uint8Array(sigBuf)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  return data + '.' + sigB64
}

async function verifyJWT(token, secret) {
  var parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid token')
  var h = parts[0]
  var p = parts[1]
  var s = parts[2]
  var data = h + '.' + p
  var key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  var sigBytes = Uint8Array.from(
    atob(s.replace(/-/g, '+').replace(/_/g, '/')),
    function(c) { return c.charCodeAt(0) }
  )
  var valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    new TextEncoder().encode(data)
  )
  if (!valid) throw new Error('Invalid signature')
  var payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')))
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired')
  }
  return payload
}

// ── CORS ──────────────────────────────────────────────────────────────────

var ALLOWED_ORIGINS = [
  'https://sarika-golden-50.pages.dev'
]

function getCORS(request) {
  var origin = request.headers.get('Origin') || ''
  var allowed = ALLOWED_ORIGINS.indexOf(origin) !== -1 ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400'
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function json(data, status, request) {
  if (status === undefined) status = 200
  var headers = Object.assign({ 'Content-Type': 'application/json' }, getCORS(request || {}))
  return new Response(JSON.stringify(data), { status: status, headers: headers })
}

function err(msg, status, request) {
  if (status === undefined) status = 400
  return json({ error: msg }, status, request)
}

async function getUser(request, env) {
  var auth = request.headers.get('Authorization')
  if (!auth || !auth.startsWith('Bearer ')) return null
  try {
    return await verifyJWT(auth.slice(7), env.JWT_SECRET)
  } catch(e) {
    return null
  }
}

async function requireAdmin(request, env) {
  var u = await getUser(request, env)
  return (u && u.role === 'admin') ? u : null
}

// ── Main handler ──────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    var url = new URL(request.url)
    var path = url.pathname.replace(/^\/api/, '')
    var method = request.method
    var cors = getCORS(request)

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    // ── AUTH ──────────────────────────────────────────────────────────

    if (path === '/auth/login' && method === 'POST') {
      var b = await request.json()
      var expected = b.role === 'admin' ? env.ADMIN_PASSWORD : env.SARIKA_PASSWORD
      if (b.password !== expected) return err('Invalid password', 401, request)
      var token = await signJWT(
        { role: b.role, sub: b.role, exp: Math.floor(Date.now() / 1000) + 2592000 },
        env.JWT_SECRET
      )
      return json({ token: token, user: { role: b.role } }, 200, request)
    }

    // ── POSTS ─────────────────────────────────────────────────────────

    if (path === '/posts' && method === 'GET') {
      var posts = await env.DB.prepare(
        "SELECT p.*, " +
        "(SELECT json_group_array(json_object('id',c.id,'name',c.name,'text',c.text)) FROM comments c WHERE c.post_id=p.id) as cj, " +
        "(SELECT json_object('thumb',COALESCE(SUM(type='thumb'),0),'wow',COALESCE(SUM(type='wow'),0),'fire',COALESCE(SUM(type='fire'),0)) FROM reactions r WHERE r.post_id=p.id) as rj " +
        "FROM posts p WHERE p.status='published' ORDER BY p.created_at DESC LIMIT 100"
      ).all()
      var result = posts.results.map(function(p) {
        var c = [], r = { thumb: 0, wow: 0, fire: 0 }
        try { c = JSON.parse(p.cj || '[]').filter(Boolean) } catch(e) {}
        try { r = JSON.parse(p.rj || '{}') } catch(e) {}
        return { id: p.id, url: p.url, type: p.type, caption: p.caption, author: p.author, status: p.status, featured: p.featured, created_at: p.created_at, comments: c, reactions: r }
      })
      return json(result, 200, request)
    }

    if (path === '/posts' && method === 'POST') {
      var form = await request.formData()
      var file = form.get('file')
      if (!file) return err('No file provided', 400, request)
      var ext = file.name.split('.').pop()
      var key = 'posts/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext
      await env.BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } })
      var mediaUrl = 'https://pub-67f4eb0e92314b19892e15bb041c1925.r2.dev/' + key
      var id = crypto.randomUUID()
      var now = new Date().toISOString()
      await env.DB.prepare(
        "INSERT INTO posts (id,url,type,caption,author,status,created_at) VALUES (?,?,?,?,?,'published',?)"
      ).bind(id, mediaUrl, form.get('type') || 'photo', form.get('caption') || '', form.get('author') || 'Guest', now).run()
      return json({ id: id, url: mediaUrl, type: form.get('type') || 'photo', caption: form.get('caption') || '', author: form.get('author') || 'Guest', status: 'published', created_at: now, reactions: { thumb: 0, wow: 0, fire: 0 }, comments: [] }, 201, request)
    }

    if (path.match(/^\/posts\/[\w-]+$/) && method === 'DELETE') {
      if (!await requireAdmin(request, env)) return err('Unauthorized', 401, request)
      var id = path.split('/')[2]
      await env.DB.prepare('DELETE FROM posts WHERE id=?').bind(id).run()
      await env.DB.prepare('DELETE FROM comments WHERE post_id=?').bind(id).run()
      await env.DB.prepare('DELETE FROM reactions WHERE post_id=?').bind(id).run()
      return json({ ok: true }, 200, request)
    }

    // ── REACTIONS ─────────────────────────────────────────────────────

    if (path.match(/^\/posts\/[\w-]+\/react$/) && method === 'POST') {
      var postId = path.split('/')[2]
      var b = await request.json()
      if (b.type !== 'thumb' && b.type !== 'wow' && b.type !== 'fire') return err('Invalid reaction', 400, request)
      await env.DB.prepare('INSERT INTO reactions (id,post_id,type) VALUES (?,?,?)').bind(crypto.randomUUID(), postId, b.type).run()
      return json({ ok: true }, 200, request)
    }

    // ── COMMENTS ──────────────────────────────────────────────────────

    if (path.match(/^\/posts\/[\w-]+\/comments$/) && method === 'GET') {
      var postId = path.split('/')[2]
      var rows = await env.DB.prepare('SELECT * FROM comments WHERE post_id=? ORDER BY created_at ASC').bind(postId).all()
      return json(rows.results, 200, request)
    }

    if (path.match(/^\/posts\/[\w-]+\/comments$/) && method === 'POST') {
      var postId = path.split('/')[2]
      var b = await request.json()
      if (!b.text || !b.text.trim()) return err('Comment text required', 400, request)
      var id = crypto.randomUUID()
      var now = new Date().toISOString()
      await env.DB.prepare('INSERT INTO comments (id,post_id,name,text,created_at) VALUES (?,?,?,?,?)').bind(id, postId, b.name || 'Guest', b.text, now).run()
      return json({ id: id, post_id: postId, name: b.name || 'Guest', text: b.text, created_at: now }, 201, request)
    }

    if (path.match(/^\/posts\/[\w-]+\/comments\/[\w-]+$/) && method === 'DELETE') {
      if (!await requireAdmin(request, env)) return err('Unauthorized', 401, request)
      var parts = path.split('/')
      await env.DB.prepare('DELETE FROM comments WHERE id=? AND post_id=?').bind(parts[4], parts[2]).run()
      return json({ ok: true }, 200, request)
    }

    // ── APPROVAL QUEUE ────────────────────────────────────────────────

    if (path === '/approval' && method === 'GET') {
      if (!await getUser(request, env)) return err('Unauthorized', 401, request)
      var rows = await env.DB.prepare('SELECT * FROM approval_queue ORDER BY created_at DESC').all()
      return json(rows.results, 200, request)
    }

    if (path === '/approval' && method === 'POST') {
      if (!await requireAdmin(request, env)) return err('Unauthorized', 401, request)
      var form = await request.formData()
      var file = form.get('file')
      if (!file) return err('No file', 400, request)
      var ext = file.name.split('.').pop()
      var key = 'approval/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext
      await env.BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } })
      var fileUrl = 'https://pub-67f4eb0e92314b19892e15bb041c1925.r2.dev/' + key
      var id = crypto.randomUUID()
      var now = new Date().toISOString()
      await env.DB.prepare(
        "INSERT INTO approval_queue (id,url,caption,status,created_at) VALUES (?,?,?,'pending',?)"
      ).bind(id, fileUrl, form.get('caption') || '', now).run()
      return json({ id: id, url: fileUrl, caption: form.get('caption') || '', status: 'pending', created_at: now }, 201, request)
    }

    if (path.match(/^\/approval\/[\w-]+\/respond$/) && method === 'POST') {
      var u = await getUser(request, env)
      if (!u || u.role !== 'sarika') return err('Unauthorized', 401, request)
      var id = path.split('/')[2]
      var b = await request.json()
      if (b.action !== 'approved' && b.action !== 'denied' && b.action !== 'enhance') return err('Invalid action', 400, request)
      await env.DB.prepare('UPDATE approval_queue SET status=?,sarika_comment=? WHERE id=?').bind(b.action, b.comment || '', id).run()
      if (b.action === 'approved') {
        var item = await env.DB.prepare('SELECT * FROM approval_queue WHERE id=?').bind(id).first()
        if (item) {
          await env.DB.prepare(
            "INSERT INTO posts (id,url,type,caption,author,status,created_at) VALUES (?,?,'photo',?,'Sarika Pick','published',?)"
          ).bind(crypto.randomUUID(), item.url, item.caption, new Date().toISOString()).run()
        }
      }
      return json({ ok: true }, 200, request)
    }

    // ── ADMIN ─────────────────────────────────────────────────────────

    if (path === '/admin/posts' && method === 'GET') {
      if (!await requireAdmin(request, env)) return err('Unauthorized', 401, request)
      var rows = await env.DB.prepare('SELECT * FROM posts ORDER BY created_at DESC').all()
      return json(rows.results, 200, request)
    }

    if (path.match(/^\/admin\/posts\/[\w-]+\/feature$/) && method === 'POST') {
      if (!await requireAdmin(request, env)) return err('Unauthorized', 401, request)
      var id = path.split('/')[3]
      await env.DB.prepare('UPDATE posts SET featured=CASE WHEN featured=1 THEN 0 ELSE 1 END WHERE id=?').bind(id).run()
      return json({ ok: true }, 200, request)
    }

    // ── AI ENHANCEMENT ────────────────────────────────────────────────

    if (path === '/ai/enhance' && method === 'POST') {
      if (!await getUser(request, env)) return err('Unauthorized', 401, request)
      var b = await request.json()
      var resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 256,
          messages: [{
            role: 'user',
            content: 'You are a professional photo editor. For this birthday celebration photo described as: "' + (b.description || 'a celebration photo') + '" give 2-3 brief specific enhancement suggestions in 2 sentences max.'
          }]
        })
      })
      var data = await resp.json()
      return json({ suggestion: data.content && data.content[0] ? data.content[0].text : 'No suggestions available.' }, 200, request)
    }

    return err('Not found', 404, request)
  }
}
