// Runs a paginated find against a model and returns { data, meta }.
export async function paginate(Model, filter, { page = 1, limit = 20, sort = { createdAt: -1 }, populate, select } = {}) {
  // Coerce to integers in case they arrive as strings from req.query
  const p = Math.max(1, parseInt(page, 10) || 1)
  const l = Math.max(1, parseInt(limit, 10) || 20)
  const skip = (p - 1) * l
  let query = Model.find(filter).sort(sort).skip(skip).limit(l)
  if (populate) query = query.populate(populate)
  if (select) query = query.select(select)

  const [data, total] = await Promise.all([query.lean(), Model.countDocuments(filter)])
  return {
    data,
    meta: { page: p, limit: l, total, pages: Math.ceil(total / l) || 1 },
  }
}
