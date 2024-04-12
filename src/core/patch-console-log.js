import chalk from 'chalk'

const { blueBright, yellowBright, bgRedBright } = chalk

const standardConsoleInfo = console.info
console.info = (...args) => {
  standardConsoleInfo('\n', blueBright('[INFO]'), ...args)
}

const standardConsoleWarn = console.warn
console.warn = (...args) => {
  standardConsoleWarn('\n', yellowBright('[WARN]'), ...args)
}

const standardConsoleError = console.error
console.error = (...args) => {
  standardConsoleError('\n', bgRedBright('[ERRO]'), ...args)
}
