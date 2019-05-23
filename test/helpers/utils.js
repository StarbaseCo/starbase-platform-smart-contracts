const should = require('chai').should()

const isException = error => {
  const strError = error.toString()

  return (
    strError.includes('invalid opcode') ||
    strError.includes('invalid JUMP') ||
    strError.includes('revert')
  )
}

const ensuresException = (error, expectedError) => {
  assert(isException(error), error.toString())

  if (expectedError !== undefined)
    assert(
      error.message.includes(expectedError),
      `Expected error '${expectedError}', received '${error.message}'`
    )
}

module.exports = {
  ensuresException,
  isException,
  should,
}
