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
  const enc = function(obj) {
    return btoa(JSON.stringify(obj))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
  }

  const header = { alg: 'HS256', typ: 'JWT' }
  const data = enc(header) + '.' + enc(payload)

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const sigB64 = btoa(String.fromCharCode.apply(null, new Uint8Array(sigBuf)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  return data + '.' + sigB64
}

async function verifyJWT(token, secret) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid token')

  const h = parts[0]
  const p = parts[1]
  const s = parts[2]
  const data = h + '.' + p

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )

  const sigBytes = Uint8Array.from(
    atob(s.replace(/-/g, '+').replace(/_/g, '/')),
    function(c) { return c.charCodeAt(0) }
  )

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    new TextEncoder().encode(data)
  )
  if (!valid) throw new Error('Invalid signature')

  const payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')))
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired')
  }
  return payload
}

// ── Helpers ───────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}

function json(data, status) {
  if (status === undefined) status = 200
  return new Response(JSON.stringify(data), {
    status: status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, CORS),
  })
}

function err(msg, status) {
  if (status === undefined) status = 400
  return json({ error: msg }, status)
}

async function getUser(request, env) {
  const auth = request.headers.get('Authorization')
  if (!auth || !auth.startsWith('Bearer ')) return null
  try {
    const payload = await verifyJWT(auth.slice(7), env.JWT_SECRET)
    return payload
  } catch (e) {
    return null
  }
}

async function requireAdmin(request, env) {
  const u = await getUser(request, env)
  if (!u || u.role !== 'admin') return null
  return u
}

// ── Main handler ──────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/api/, '')
    const method = request.method

    if (method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    // ── AUTH ──────────────────────────────────────────────────────────

    if (path === '/auth/login' && method === 'POST') {
      const body = await request.json()
      const password = body.password
      const role = body.role
      const expected = role === 'admin' ? env.ADMIN_PASSWORD : env.SARIKA_PASSWORD
      if (password !== expected) return err('Invalid password', 401)

      const token = await signJWT(
        {
          role: role,
          sub: role,
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
        },
        env.JWT_SECRET
      )
      return json({ token: token, user: { role: role } })
    }

    // ── POSTS ─────────────────────────────────────────────────────────

    if (path === '/posts' && method === 'GET') {
      const posts = await env.DB.prepare(
        'SELECT p.*, ' +
        '(SELECT json_group_array(json_object(\'id\',c.id,\'name\',c.name,\'text\',c.text)) FROM comments c WHERE c.post_id=p.id) as comments_json, ' +
        '(SELECT json_object(\'thumb\', COALESCE(SUM(type=\'thumb\'),0), \'wow\', COALESCE(SUM(type=\'wow\'),0), \'fire\', COALESCE(SUM(type=\'fire\'),0)) FROM reactions r WHERE r.post_id=p.id) as reactions_json ' +
        'FROM posts p WHERE p.status=\'published\' ORDER BY p.created_at DESC LIMIT 100'
      ).all()

      const result = posts.results.map(function(p) {
        var comments = []
        var reactions = { thumb: 0, wow: 0, fire: 0 }
        try { comments = JSON.parse(p.comments_json || '[]').filter(Boolean) } catch(e) {}
        try { reactions = JSON.parse(p.reactions_json || '{"thumb":0,"wow":0,"fire":0}') } catch(e) {}
        return {
          id: p.id,
          url: p.url,
          type: p.type,
          caption: p.caption,
          author: p.author,
          status: p.status,
          featured: p.featured,
          created_at: p.created_at,
          comments: comments,
          reactions: reactions,
        }
      })
      return json(result)
    }

    if (path === '/posts' && method === 'POST') {
      const form = await request.formData()
      const file = form.get('file')
      const caption = form.get('caption') || ''
      const author = form.get('author') || 'Guest'
      const type = form.get('type') || 'photo'

      if (!file) return err('No file provided')

      const nameParts = file.name.split('.')
      const ext = nameParts[nameParts.length - 1]
      const key = 'posts/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext
      await env.BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } })

      const mediaUrl = 'https://YOUR_R2_PUBLIC_URL/' + key

      const id = crypto.randomUUID()
      const created_at = new Date().toISOString()
      await env.DB.prepare(
        'INSERT INTO posts (id, url, type, caption, author, status, created_at) VALUES (?,?,?,?,?,\'published\',?)'
      ).bind(id, mediaUrl, type, caption, author, created_at).run()

      return json({
        id: id,
        url: mediaUrl,
        type: type,
        caption: caption,
        author: author,
        status: 'published',
        created_at: created_at,
        reactions: { thumb: 0, wow: 0, fire: 0 },
        comments: [],
      }, 201)
    }

    if (path.match(/^\/posts\/[\w-]+$/) && method === 'DELETE') {
      const user = await requireAdmin(request, env)
      if (!user) return err('Unauthorized', 401)
      const id = path.split('/')[2]
      await env.DB.prepare('DELETE FROM posts WHERE id=?').bind(id).run()
      await env.DB.prepare('DELETE FROM comments WHERE post_id=?').bind(id).run()
      await env.DB.prepare('DELETE FROM reactions WHERE post_id=?').bind(id).run()
      return json({ ok: true })
    }

    // ── REACTIONS ─────────────────────────────────────────────────────

    if (path.match(/^\/posts\/[\w-]+\/react$/) && method === 'POST') {
      const postId = path.split('/')[2]
      const body = await request.json()
      const type = body.type
      if (type !== 'thumb' && type !== 'wow' && type !== 'fire') return err('Invalid reaction')
      await env.DB.prepare('INSERT INTO reactions (id, post_id, type) VALUES (?,?,?)')
        .bind(crypto.randomUUID(), postId, type).run()
      return json({ ok: true })
    }

    // ── COMMENTS ──────────────────────────────────────────────────────

    if (path.match(/^\/posts\/[\w-]+\/comments$/) && method === 'GET') {
      const postId = path.split('/')[2]
      const rows = await env.DB.prepare(
        'SELECT * FROM comments WHERE post_id=? ORDER BY created_at ASC'
      ).bind(postId).all()
      return json(rows.results)
    }

    if (path.match(/^\/posts\/[\w-]+\/comments$/) && method === 'POST') {
      const postId = path.split('/')[2]
      const body = await request.json()
      const text = body.text
      const name = body.name
      if (!text || !text.trim()) return err('Comment text required')
      const id = crypto.randomUUID()
      const created_at = new Date().toISOString()
      await env.DB.prepare(
        'INSERT INTO comments (id, post_id, name, text, created_at) VALUES (?,?,?,?,?)'
      ).bind(id, postId, name || 'Guest', text, created_at).run()
      return json({ id: id, post_id: postId, name: name || 'Guest', text: text, created_at: created_at }, 201)
    }

    if (path.match(/^\/posts\/[\w-]+\/comments\/[\w-]+$/) && method === 'DELETE') {
      const user = await requireAdmin(request, env)
      if (!user) return err('Unauthorized', 401)
      const parts = path.split('/')
      const postId = parts[2]
      const cid = parts[4]
      await env.DB.prepare('DELETE FROM comments WHERE id=? AND post_id=?').bind(cid, postId).run()
      return json({ ok: true })
    }

    // ── APPROVAL QUEUE ────────────────────────────────────────────────

    if (path === '/approval' && method === 'GET') {
      const user = await getUser(request, env)
      if (!user) return err('Unauthorized', 401)
      const rows = await env.DB.prepare(
        'SELECT * FROM approval_queue ORDER BY created_at DESC'
      ).all()
      return json(rows.results)
    }

    if (path === '/approval' && method === 'POST') {
      const user = await requireAdmin(request, env)
      if (!user) return err('Unauthorized', 401)
      const form = await request.formData()
      const file = form.get('file')
      const caption = form.get('caption') || ''
      if (!file) return err('No file')

      const nameParts = file.name.split('.')
      const ext = nameParts[nameParts.length - 1]
      const key = 'approval/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext
      await env.BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } })

      const url = `https://pub-67f4eb0e92314b19892e15bb041c1925.r2.dev${key}`

      const id = crypto.randomUUID()
      const created_at = new Date().toISOString()
      await env.DB.prepare(
        'INSERT INTO approval_queue (id, url, caption, status, created_at) VALUES (?,?,?,\'pending\',?)'
      ).bind(id, url, caption, created_at).run()
      return json({ id: id, url: url, caption: caption, status: 'pending', created_at: created_at }, 201)
    }

    if (path.match(/^\/approval\/[\w-]+\/respond$/) && method === 'POST') {
      const user = await getUser(request, env)
      if (!user || user.role !== 'sarika') return err('Unauthorized', 401)
      const id = path.split('/')[2]
      const body = await request.json()
      const action = body.action
      const comment = body.comment || ''
      if (action !== 'approved' && action !== 'denied' && action !== 'enhance') {
        return err('Invalid action')
      }

      await env.DB.prepare(
        'UPDATE approval_queue SET status=?, sarika_comment=? WHERE id=?'
      ).bind(action, comment, id).run()

      if (action === 'approved') {
        const item = await env.DB.prepare(
          'SELECT * FROM approval_queue WHERE id=?'
        ).bind(id).first()
        if (item) {
          const postId = crypto.randomUUID()
          await env.DB.prepare(
            'INSERT INTO posts (id, url, type, caption, author, status, created_at) VALUES (?,?,\'photo\',?,\'Sarika Pick\',\'published\',?)'
          ).bind(postId, item.url, item.caption, new Date().toISOString()).run()
        }
      }
      return json({ ok: true })
    }

    // ── ADMIN ─────────────────────────────────────────────────────────

    if (path === '/admin/posts' && method === 'GET') {
      const user = await requireAdmin(request, env)
      if (!user) return err('Unauthorized', 401)
      const rows = await env.DB.prepare(
        'SELECT * FROM posts ORDER BY created_at DESC'
      ).all()
      return json(rows.results)
    }

    if (path.match(/^\/admin\/posts\/[\w-]+\/feature$/) && method === 'POST') {
      const user = await requireAdmin(request, env)
      if (!user) return err('Unauthorized', 401)
      const id = path.split('/')[3]
      await env.DB.prepare(
        'UPDATE posts SET featured = CASE WHEN featured=1 THEN 0 ELSE 1 END WHERE id=?'
      ).bind(id).run()
      return json({ ok: true })
    }

    // ── AI ENHANCEMENT ────────────────────────────────────────────────

    if (path === '/ai/enhance' && method === 'POST') {
      const user = await getUser(request, env)
      if (!user) return err('Unauthorized', 401)
      const body = await request.json()
      const description = body.description || 'a celebration photo'

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 256,
          messages: [
            {
              role: 'user',
              content: 'You are a professional photo editor. For this birthday celebration photo described as: "' +
                description +
                '" give 2-3 brief specific enhancement suggestions (lighting, color grading, cropping, etc.) in 2 sentences max. Be practical and concise.',
            },
          ],
        }),
      })

      const data = await resp.json()
      const suggestion =
        data.content && data.content[0] && data.content[0].text
          ? data.content[0].text
          : 'No suggestions available.'
      return json({ suggestion: suggestion })
    }

    return err('Not found', 404)
  },
}
