// API base — in production this points to your Cloudflare Worker
const BASE = import.meta.env.VITE_API_URL || '/api'

async function request(method, path, body, isFormData = false) {
  const opts = {
    method,
    headers: {}
  }
  if (body) {
    if (isFormData) {
      opts.body = body
    } else {
      opts.headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify(body)
    }
  }
  // Include auth token if present
  const token = localStorage.getItem('sarika_token')
  if (token) opts.headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}

export const api = {
  // Auth
  login: (password, role) => request('POST', '/auth/login', { password, role }),
  
  // Posts (photos + videos)
  getPosts: ()         => request('GET', '/posts'),
  createPost: (form)   => request('POST', '/posts', form, true),
  deletePost: (id)     => request('DELETE', `/posts/${id}`),
  
  // Reactions
  react: (postId, type) => request('POST', `/posts/${postId}/react`, { type }),
  
  // Comments
  getComments: (postId) => request('GET', `/posts/${postId}/comments`),
  addComment: (postId, text, name) => request('POST', `/posts/${postId}/comments`, { text, name }),
  deleteComment: (postId, cid)     => request('DELETE', `/posts/${postId}/comments/${cid}`),
  
  // Approval queue (admin → Sarika)
  getApprovalQueue: ()             => request('GET', '/approval'),
  submitForApproval: (form)        => request('POST', '/approval', form, true),
  respondToApproval: (id, action, comment) => request('POST', `/approval/${id}/respond`, { action, comment }),
  
  // Admin
  getAdminPosts: ()   => request('GET', '/admin/posts'),
  featurePost: (id)   => request('POST', `/admin/posts/${id}/feature`),
  
  // AI Enhancement (proxied through worker to protect API key)
  enhancePhoto: (description) => request('POST', '/ai/enhance', { description })
}
