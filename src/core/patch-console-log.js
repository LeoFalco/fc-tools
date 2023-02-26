const chalk = require('chalk')

const { bgBlue, bgYellow, bgRed } = chalk

const standardConsoleInfo = console.info
console.info = (...args) => {
  standardConsoleInfo(bgBlue(' INFO '), ...args)
}

const standardConsoleWarn = console.warn
console.warn = (...args) => {
  standardConsoleWarn(bgYellow(' WARN '), ...args)
}

const standardConsoleError = console.error
console.error = (...args) => {
  standardConsoleError(bgRed(' ERROR '), ...args)
}
