import chalk from 'chalk'
import clipboard from 'clipboardy'
import { oraPromise as loadingSpinner } from 'ora'
import { eC2Facade } from './ec2.js'

const { blue, green, red } = chalk
const instanceId = 'i-04884a513b9b40bdb'

class BastionCommand {
  install ({ program }) {
    const bastion = program
      .command('bastion')
      .description('Manage the FSM bastion EC2 instance')

    bastion
      .command('start', { isDefault: true })
      .description('Starts the instance')
      .action(start)

    bastion
      .command('stop')
      .description('Stops the instance')
      .action(stop)

    bastion
      .command('state')
      .description('Shows the instance state')
      .action(state)

    bastion
      .command('ip')
      .description('Authorize current public IP for SSH on the bastion SG')
      .action(syncIp)

    bastion
      .command('group')
      .description('assign security groups')
      .option('-a, --add <id>', 'add group by id')
      .option('-r, --remove <id>', 'remove group by id')
      .option('-s, --search <searchTerm>', 'search for not linked groups')
      .action(group)
  }
}

async function start () {
  const instance = await loadingSpinner(eC2Facade.startInstance({ instanceId }), {
    text: 'Starting instance...',
    failText: 'Failed to start instance',
    successText: 'Instance started!'
  })

  await loadingSpinner(eC2Facade.syncMySshIngress({ instanceId }), {
    text: 'Authorizing current IP for SSH...',
    failText: 'Failed to authorize current IP',
    successText: 'SSH ingress in sync with current IP!'
  })

  const sshCommand = `ssh -i ~/.ssh/developer.pem ubuntu@${instance?.PublicDnsName} -o ServerAliveInterval=60`

  console.log('')
  console.log(sshCommand)
  console.log('')
  console.log(blue('SSH connection command copied to clipboard!'))

  clipboard.writeSync(sshCommand)
}

async function stop () {
  const stopInstancePromise = eC2Facade.stopInstance({ instanceId })

  await loadingSpinner(stopInstancePromise, {
    text: 'Stopping instance...',
    failText: 'Failed to stop instance',
    successText: 'Instance stopped!'
  })
}

async function state () {
  const instance = await eC2Facade.getInstance({ instanceId })
  const color = isRunning(instance) ? green : red
  console.log(blue(`instance state is ${color(instance?.State?.Name)}`))
}

function isRunning (instance) {
  return instance?.State?.Name === 'running'
}

async function syncIp () {
  await loadingSpinner(eC2Facade.syncMySshIngress({ instanceId }), {
    text: 'Authorizing current IP for SSH...',
    failText: 'Failed to authorize current IP',
    successText: 'SSH ingress in sync with current IP!'
  })
}

async function group (params) {
  params.search = params.search || ''

  console.log('Listing security groups for instance:', instanceId, JSON.stringify(params, null, 2))
  const groups = await eC2Facade.listSecurityGroups({ instanceId })

  console.log('Linked groups: ', groups.linked.length)
  for (const group of groups.linked) {
    console.log(` - ${group.GroupId} ${group.GroupName}`)
  }

  console.log('Not linked groups:', groups.notLinked.length)
  for (const group of groups.notLinked.filter(group => group.GroupId.includes(params.search) || group.GroupName.includes(params.search))) {
    console.log(` - ${group.GroupId} ${group.GroupName}`)
  }

  const currentGroupIds = groups.linked.map(group => group.GroupId)
  const newGroupIds = [...currentGroupIds]

  if (params.add && !newGroupIds.includes(params.add)) {
    newGroupIds.push(params.add)
  }

  if (params.remove && newGroupIds.includes(params.remove)) {
    newGroupIds.splice(newGroupIds.indexOf(params.remove), 1)
  }

  if (JSON.stringify(currentGroupIds) === JSON.stringify(newGroupIds)) {
    console.log('noting to change')
    return
  }

  console.log('currentGroupIds', currentGroupIds)
  console.log('newGroupIds', newGroupIds)

  await eC2Facade.setSecurityGroups({
    instanceId,
    groupIds: newGroupIds
  })

  console.log('groups set')
}

export default new BastionCommand()
