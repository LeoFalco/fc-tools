import chalk from 'chalk'

const { blue, yellow, bgRed } = chalk

const standardConsoleInfo = console.info
console.info = (...args) => {
  standardConsoleInfo(blue(' INFO '), ...args)
}

const standardConsoleWarn = console.warn
console.warn = (...args) => {
  standardConsoleWarn(yellow(' WARN '), ...args)
}

const standardConsoleError = console.error
console.error = (...args) => {
  standardConsoleError(bgRed(' ERRO '), ...args)
}
