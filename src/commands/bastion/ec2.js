import { EC2, StartInstancesCommand, DescribeInstancesCommand, waitUntilInstanceRunning, StopInstancesCommand, waitUntilInstanceStopped, DescribeSecurityGroupsCommand, ModifyInstanceAttributeCommand, AuthorizeSecurityGroupIngressCommand, RevokeSecurityGroupIngressCommand } from '@aws-sdk/client-ec2'
import { fromIni } from '@aws-sdk/credential-providers'
import axios from 'axios'
import os from 'os'
import { setTimeout } from 'timers/promises'

const BASTION_SG_NAME = 'Bastion host (developer)'

const ec2 = new EC2({
  region: 'sa-east-1',
  credentials: fromIni({ profile: 'bastion' })
})

class EC2Facade {
  async getInstance ({ instanceId }) {
    return ec2.send(new DescribeInstancesCommand({
      InstanceIds: [instanceId]
    }))
      .then(result => {
        return result?.Reservations[0]?.Instances[0]
      })
  }

  async startInstance ({ instanceId }) {
    const instance = await ec2.send(new StartInstancesCommand({
      InstanceIds: [instanceId]
    }))
      .then(result => {
        return result.StartingInstances && result.StartingInstances[0]
      })

    console.log(`\n- Instance state is ${instance?.PreviousState?.Name}`)

    if (instance?.PreviousState?.Name !== 'running') {
      await waitUntilInstanceRunning({
        client: ec2,
        maxWaitTime: 120
      }, {
        InstanceIds: [instanceId]
      })
      console.log('\n- Waiting 10 seconds for instance to be ready for ssh connections...')
      await setTimeout(10_000)
    }

    return this.getInstance({ instanceId })
  }

  async stopInstance ({ instanceId }) {
    const instance = await ec2.send(new StopInstancesCommand({
      InstanceIds: [instanceId]
    })).then(result => result.StoppingInstances?.[0])

    console.log(`\n- Instance state is ${instance?.PreviousState?.Name}`)
    if (instance?.PreviousState?.Name !== 'stopped') {
      await waitUntilInstanceStopped({
        client: ec2,
        maxWaitTime: 120
      }, {
        InstanceIds: [instanceId]
      })
    }
  }

  async setSecurityGroups ({ instanceId, groupIds }) {
    await ec2.send(new ModifyInstanceAttributeCommand({
      InstanceId: instanceId,
      Groups: groupIds
    }))
  }

  async syncMySshIngress ({ instanceId }) {
    const myIp = (await axios.get('https://checkip.amazonaws.com')).data.trim()
    const cidr = `${myIp}/32`
    const description = `Leo @ ${os.hostname()}`

    const instance = await this.getInstance({ instanceId })
    const bastionSg = (instance.SecurityGroups || []).find(sg => sg.GroupName === BASTION_SG_NAME)
    if (!bastionSg) {
      throw new Error(`Bastion SG "${BASTION_SG_NAME}" not attached to instance ${instanceId}`)
    }

    const { SecurityGroups: [sg] } = await ec2.send(new DescribeSecurityGroupsCommand({
      GroupIds: [bastionSg.GroupId]
    }))

    const sshPermissions = (sg.IpPermissions || []).filter(p => p.IpProtocol === 'tcp' && p.FromPort === 22 && p.ToPort === 22)
    const alreadyAuthorized = sshPermissions.some(p => (p.IpRanges || []).some(r => r.CidrIp === cidr))

    if (alreadyAuthorized) {
      console.log(`- SSH ingress already authorized for ${cidr} on ${bastionSg.GroupId}`)
      return { groupId: bastionSg.GroupId, cidr, changed: false }
    }

    if (sshPermissions.length > 0) {
      await ec2.send(new RevokeSecurityGroupIngressCommand({
        GroupId: bastionSg.GroupId,
        IpPermissions: sshPermissions
      }))
    }

    await ec2.send(new AuthorizeSecurityGroupIngressCommand({
      GroupId: bastionSg.GroupId,
      IpPermissions: [{
        IpProtocol: 'tcp',
        FromPort: 22,
        ToPort: 22,
        IpRanges: [{ CidrIp: cidr, Description: description }]
      }]
    }))

    console.log(`- SSH ingress updated on ${bastionSg.GroupId}: ${cidr} (${description})`)
    return { groupId: bastionSg.GroupId, cidr, changed: true }
  }

  async listSecurityGroups ({ instanceId }) {
    const instance = await this.getInstance({ instanceId })
    const linked = instance.SecurityGroups || []

    const groups = await ec2.send(new DescribeSecurityGroupsCommand({
      MaxResults: 1000
    }))

    const allGroups = groups.SecurityGroups
    const linkedIds = linked.map(group => group.GroupId)

    const notLinked = allGroups.map(group => {
      return {
        GroupId: group.GroupId,
        GroupName: group.GroupName
      }
    }).filter(group => !linkedIds.includes(group.GroupId))

    if (groups.NextToken) {
      console.warn('Has next groups page')
    } else {
      console.warn('Has not next groups page')
    }

    return {
      linked,
      notLinked
    }
  }
}

export const eC2Facade = new EC2Facade()
