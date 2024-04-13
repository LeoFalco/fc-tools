import chalk from 'chalk'

const { bgBlueBright, bgYellowBright, bgRedBright } = chalk

export const info = (...args) => {
  console.info(bgBlueBright(' INFO '), ...args)
}

export const warn = (...args) => {
  console.warn(bgYellowBright(' WARN '), ...args)
}

export const error = (...args) => {
  console.error(bgRedBright(' ERRO '), ...args)
}
