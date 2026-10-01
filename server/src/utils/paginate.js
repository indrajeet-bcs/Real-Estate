// Runs a paginated find against a model and returns { data, meta }.
export async function paginate(Model, filter, { page = 1, limit = 20, sort = { createdAt: -1 }, populate, select } = {}) {
  const skip = (page - 1) * limit
  let query = Model.find(filter).sort(sort).skip(skip).limit(limit)
  if (populate) query = query.populate(populate)
  if (select) query = query.select(select)

  const [data, total] = await Promise.all([query.lean(), Model.countDocuments(filter)])
  return {
    data,
    meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  }
}
