/**
 * Sarika Golden 50 — Cloudflare Worker Backend
 * 
 * Bindings required (set in wrangler.toml / Cloudflare dashboard):
 *   DB       → D1 database (SQLite)
 *   BUCKET   → R2 bucket for media files
 *   ANTHROPIC_API_KEY → secret for AI enhancement
 *   ADMIN_PASSWORD    → secret for admin login
 *   SARIKA_PASSWORD   → secret for Sarika's login
 *   JWT_SECRET        → secret for signing tokens
 */

import { SignJWT, jwtVerify } from 'https://cdn.jsdelivr.net/npm/jose@5/dist/webworker/index.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS }
  })
}

function err(msg, status = 400) {
  return json({ error: msg }, status)
}

async function getUser(request, env) {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const { payload } = await jwtVerify(auth.slice(7), new TextEncoder().encode(env.JWT_SECRET))
    return payload
  } catch { return null }
}

async function requireAdmin(request, env) {
  const u = await getUser(request, env)
  if (!u || u.role !== 'admin') return null
  return u
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/api/, '')
    const method = request.method

    if (method === 'OPTIONS') return new Response(null, { headers: CORS })

    /* ── AUTH ────────────────────────────────────────────────────── */

    if (path === '/auth/login' && method === 'POST') {
      const { password, role } = await request.json()
      const expected = role === 'admin' ? env.ADMIN_PASSWORD : env.SARIKA_PASSWORD
      if (password !== expected) return err('Invalid password', 401)
      const token = await new SignJWT({ role, sub: role })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('30d')
        .sign(new TextEncoder().encode(env.JWT_SECRET))
      return json({ token, user: { role } })
    }

    /* ── POSTS ───────────────────────────────────────────────────── */

    if (path === '/posts' && method === 'GET') {
      const posts = await env.DB.prepare(
        `SELECT p.*, 
          (SELECT json_group_array(json_object('id',c.id,'name',c.name,'text',c.text)) FROM comments c WHERE c.post_id=p.id) as comments_json,
          (SELECT json_object('thumb', COALESCE(SUM(type='thumb'),0), 'wow', COALESCE(SUM(type='wow'),0), 'fire', COALESCE(SUM(type='fire'),0))
           FROM reactions r WHERE r.post_id=p.id) as reactions_json
         FROM posts p WHERE p.status='published' ORDER BY p.created_at DESC LIMIT 100`
      ).all()
      const result = posts.results.map(p => ({
        ...p,
        comments: JSON.parse(p.comments_json || '[]').filter(Boolean),
        reactions: JSON.parse(p.reactions_json || '{"thumb":0,"wow":0,"fire":0}'),
        comments_json: undefined,
        reactions_json: undefined,
      }))
      return json(result)
    }

    if (path === '/posts' && method === 'POST') {
      const form = await request.formData()
      const file = form.get('file')
      const caption = form.get('caption') || ''
      const author = form.get('author') || 'Guest'
      const type = form.get('type') || 'photo'

      if (!file) return err('No file provided')

      // Upload to R2
      const ext = file.name.split('.').pop()
      const key = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      await env.BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } })
      const mediaUrl = `https://media.sarika50.com/${key}` // set your R2 custom domain

      const id = crypto.randomUUID()
      await env.DB.prepare(
        `INSERT INTO posts (id, url, type, caption, author, status, created_at) VALUES (?,?,?,?,?,'published',?)`
      ).bind(id, mediaUrl, type, caption, author, new Date().toISOString()).run()

      return json({ id, url: mediaUrl, type, caption, author, status: 'published', created_at: new Date().toISOString(), reactions: { thumb: 0, wow: 0, fire: 0 }, comments: [] }, 201)
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

    /* ── REACTIONS ───────────────────────────────────────────────── */

    if (path.match(/^\/posts\/[\w-]+\/react$/) && method === 'POST') {
      const postId = path.split('/')[2]
      const { type } = await request.json()
      if (!['thumb','wow','fire'].includes(type)) return err('Invalid reaction')
      await env.DB.prepare('INSERT INTO reactions (id,post_id,type) VALUES (?,?,?)')
        .bind(crypto.randomUUID(), postId, type).run()
      return json({ ok: true })
    }

    /* ── COMMENTS ────────────────────────────────────────────────── */

    if (path.match(/^\/posts\/[\w-]+\/comments$/) && method === 'GET') {
      const postId = path.split('/')[2]
      const rows = await env.DB.prepare('SELECT * FROM comments WHERE post_id=? ORDER BY created_at ASC').bind(postId).all()
      return json(rows.results)
    }

    if (path.match(/^\/posts\/[\w-]+\/comments$/) && method === 'POST') {
      const postId = path.split('/')[2]
      const { text, name } = await request.json()
      if (!text?.trim()) return err('Comment text required')
      const id = crypto.randomUUID()
      const created_at = new Date().toISOString()
      await env.DB.prepare('INSERT INTO comments (id,post_id,name,text,created_at) VALUES (?,?,?,?,?)')
        .bind(id, postId, name || 'Guest', text, created_at).run()
      return json({ id, post_id: postId, name: name || 'Guest', text, created_at }, 201)
    }

    if (path.match(/^\/posts\/[\w-]+\/comments\/[\w-]+$/) && method === 'DELETE') {
      const user = await requireAdmin(request, env)
      if (!user) return err('Unauthorized', 401)
      const [,, postId,, cid] = path.split('/')
      await env.DB.prepare('DELETE FROM comments WHERE id=? AND post_id=?').bind(cid, postId).run()
      return json({ ok: true })
    }

    /* ── APPROVAL QUEUE ──────────────────────────────────────────── */

    if (path === '/approval' && method === 'GET') {
      const user = await getUser(request, env)
      if (!user) return err('Unauthorized', 401)
      const rows = await env.DB.prepare('SELECT * FROM approval_queue ORDER BY created_at DESC').all()
      return json(rows.results)
    }

    if (path === '/approval' && method === 'POST') {
      const user = await requireAdmin(request, env)
      if (!user) return err('Unauthorized', 401)
      const form = await request.formData()
      const file = form.get('file')
      const caption = form.get('caption') || ''
      if (!file) return err('No file')

      const ext = file.name.split('.').pop()
      const key = `approval/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      await env.BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } })
      const url = `https://media.sarika50.com/${key}`

      const id = crypto.randomUUID()
      const created_at = new Date().toISOString()
      await env.DB.prepare('INSERT INTO approval_queue (id,url,caption,status,created_at) VALUES (?,?,?,\'pending\',?)')
        .bind(id, url, caption, created_at).run()
      return json({ id, url, caption, status: 'pending', created_at }, 201)
    }

    if (path.match(/^\/approval\/[\w-]+\/respond$/) && method === 'POST') {
      const user = await getUser(request, env)
      if (!user || user.role !== 'sarika') return err('Unauthorized', 401)
      const id = path.split('/')[2]
      const { action, comment } = await request.json()
      if (!['approved','denied','enhance'].includes(action)) return err('Invalid action')

      await env.DB.prepare('UPDATE approval_queue SET status=?, sarika_comment=? WHERE id=?')
        .bind(action, comment || '', id).run()

      // If approved, auto-publish to posts
      if (action === 'approved') {
        const item = await env.DB.prepare('SELECT * FROM approval_queue WHERE id=?').bind(id).first()
        if (item) {
          const postId = crypto.randomUUID()
          await env.DB.prepare('INSERT INTO posts (id,url,type,caption,author,status,created_at) VALUES (?,?,\'photo\',?,\'Sarika's Pick\',\'published\',?)')
            .bind(postId, item.url, item.caption, new Date().toISOString()).run()
        }
      }
      return json({ ok: true })
    }

    /* ── ADMIN ───────────────────────────────────────────────────── */

    if (path === '/admin/posts' && method === 'GET') {
      const user = await requireAdmin(request, env)
      if (!user) return err('Unauthorized', 401)
      const rows = await env.DB.prepare('SELECT * FROM posts ORDER BY created_at DESC').all()
      return json(rows.results)
    }

    if (path.match(/^\/admin\/posts\/[\w-]+\/feature$/) && method === 'POST') {
      const user = await requireAdmin(request, env)
      if (!user) return err('Unauthorized', 401)
      const id = path.split('/')[3]
      await env.DB.prepare('UPDATE posts SET featured = NOT featured WHERE id=?').bind(id).run()
      return json({ ok: true })
    }

    /* ── AI ENHANCEMENT ──────────────────────────────────────────── */

    if (path === '/ai/enhance' && method === 'POST') {
      const user = await getUser(request, env)
      if (!user) return err('Unauthorized', 401)
      const { description } = await request.json()

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
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
            content: `You are a professional photo editor. For this birthday celebration photo described as: "${description}" — give 2-3 brief, specific enhancement suggestions (lighting, color grading, cropping, etc.) in 2 sentences max. Be practical and concise.`
          }]
        })
      })
      const data = await resp.json()
      const suggestion = data.content?.[0]?.text || 'No suggestions available.'
      return json({ suggestion })
    }

    return err('Not found', 404)
  }
}
