// Uniform success envelope so the frontend can rely on a stable shape.
export function ok(res, data = null, message = 'OK', meta = undefined) {
  return res.status(200).json({ success: true, message, data, meta })
}

export function created(res, data = null, message = 'Created') {
  return res.status(201).json({ success: true, message, data })
}
