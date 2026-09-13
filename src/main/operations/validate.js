/** Throws unless every named field is present and non-empty in the payload. */
function requireFields(operation, payload, names) {
  names.forEach((name) => {
    const value = payload[name];
    if (value === undefined || value === null || value === '') {
      throw new Error(`${operation}: ${name} is required`);
    }
  });
}

/** Throws unless the field is a non-empty array. */
function requireList(operation, payload, name) {
  if (!Array.isArray(payload[name]) || payload[name].length === 0) {
    throw new Error(`${operation}: ${name} must be a non-empty list`);
  }
  return payload[name];
}

module.exports = { requireFields, requireList };
