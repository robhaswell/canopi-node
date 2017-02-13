const individual = require('individual')
const levels = ['debug', 'info', 'warn', 'error']

const canopiConfig = individual('__CANOPI_CONFIG', {
  outputStream: process.stdout,
  dateProvider: () => new Date(),
  errorHandlers: []
})

class CanopiUsageError extends Error {
  constructor (message) {
    super(message)
    this.name = 'CanopiUsageError'
    this.message = message
  }
}

const _parseArgs = (a1, a2) => {
  let logName
  let obj = {}

  if (a2 !== undefined) {
    if (typeof (a1) !== 'string' && a1 !== undefined) {
      throw new TypeError('When providing two arguments, first argument must be a string or undefined')
    }
    if (typeof (a2) !== 'object') {
      throw new TypeError('When providing two arguments, second argument must be an object')
    }
    logName = a1
    obj = a2
  } else if (a1 !== undefined) {
    if (typeof (a1) === 'string') {
      logName = a1
    } else if (typeof (a1) === 'object') {
      obj = a1
    } else {
      throw new TypeError('Argument must be a name or object', a1)
    }
  } else {
    logName = undefined
    obj = {}
  }
  return [logName, obj]
}

function canopi (a1, a2) {
  const [logName, obj] = _parseArgs(a1, a2)

  function canopiLogger (a1, a2) {
    const [newNamePart, newObjParts] = _parseArgs(a1, a2)
    const parts = [ logName, newNamePart ].filter(Boolean)
    const newName = parts.join(':') || undefined

    const newObj = {}
    for (const k in (obj || {})) {
      newObj[k] = obj[k]
    }
    for (const k in (newObjParts || {})) {
      newObj[k] = newObjParts[k]
    }

    return canopi(newName, newObj)
  }

  canopiLogger.logName = logName
  canopiLogger.obj = obj

  for (const level of levels) {
    /* Note: The order that the loggable object is constructed is tweaked so
     * that the most interesting properties appear first when executing under
     * Node.
     */
    canopiLogger[level] = function (a1, a2) {
      const loggable = { timestamp: canopiConfig.dateProvider().toISOString() }
      if (this.logName !== undefined) {
        loggable.name = this.logName
      }
      loggable.severity = level

      try {
        if (typeof (a1) === 'string') {
          loggable.message = a1

          if (typeof (a2) === 'object') {
            for (const k in a2) {
              loggable[k] = a2[k]
            }
          } else if (a2 !== undefined) {
            throw new CanopiUsageError('When logging a string message, the second argument must be an object if provided')
          }
        } else if (a1 instanceof Error) {
          // Messages and objects are logegd before the error for readability.
          if (typeof (a2) === 'string') {
            loggable.message = a2
          } else if (typeof (a2) === 'object') {
            for (const k in a2) {
              loggable[k] = a2[k]
            }
          } else if (a2 !== undefined) {
            throw new CanopiUsageError('When logging an error, the second argument must be a string or object if provided')
          }

          loggable.err = {
            name: a1.name,
            message: a1.message
          }
          // Log the code if we have one.
          if (a1.code) {
            loggable.err.code = a1.code
          }
          loggable.err.stack = a1.stack

          for (const handler of canopiConfig.errorHandlers) {
            handler(a1)
          }
        } else if (typeof (a1) === 'object') {
          if (a2 !== undefined) {
            throw new CanopiUsageError('When logging an object, there can be no other arguments')
          }
          for (const k in a1) {
            loggable[k] = a1[k]
          }
        } else if (a1 === undefined) {
          throw new CanopiUsageError('Log message, object or error not provided')
        } else {
          throw new CanopiUsageError('Unsupported argument')
        }
      } catch (e) {
        return canopiLogger[level](e)
      }

      canopiConfig.outputStream.write(JSON.stringify(loggable) + '\n')
    }
  }

  return canopiLogger
}

module.exports = canopi
module.exports.setOutputStream = (stream) => {
  canopiConfig.outputStream = stream
}
module.exports.setDateProvider = (dateProvider) => {
  canopiConfig.dateProvider = dateProvider
}
module.exports.addErrorHandler = (handler) => {
  canopiConfig.errorHandlers.push(handler)
}
module.exports.quiet = () => {
  canopiConfig.outputStream = { write: () => {} }
  canopiConfig.errorHandlers = []
}
