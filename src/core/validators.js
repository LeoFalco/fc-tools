export function dateValidator (input) {
  if (new Date(input).toString() === 'Invalid Date') return 'Data inválida'
  return true
}

export function dateFilter (input) {
  return new Date(input).toISOString().split('T').shift()
}

export function notNullValidator (text) {
  return (input) => {
    if (!input) {
      return text
    }

    return true
  }
}
