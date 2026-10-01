import { ApiError } from '../utils/ApiError.js'

// Validates req[source] against a zod schema, replacing it with the parsed
// (coerced/defaulted) value. Usage: validate(schema) or validate(schema, 'query').
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source])
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }))
      return next(ApiError.badRequest('Validation failed', details))
    }
    req[source] = result.data
    next()
  }
}
