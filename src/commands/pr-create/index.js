class PrCreateCommand {
  install ({ program }) {
    program
      .command('pr').description('manage pull requests')
      .command('create').description('create a new pull request')
      .action(this.action)
  }

  async action () {
    console.log('Coming soon!')
  }
}

export default new PrCreateCommand()
