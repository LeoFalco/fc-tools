import { concat } from 'lodash-es'

const CMMS_PROJECT_TEAM_MEMBERS = [
  'LeoFalco',
  'willaug',
  'tauk7'
]

const CMMS_MAINTENANCE_TEAM_MEMBERS = [
  'pedroaugusto2002',
  'VBDomingos'
]

const FSM_PROJECT_TEAM_MEMBERS = ['caiorsantanna', 'PedroHenriqueGazola']

const FSM_MAINTENANCE_TEAM_MEMBERS = [
  'Carlos-F-Braga',
  'cesarfield',
  'gabrieel1007',
  'JorgeCJ',
  'matheusjurkovich',
  'rafaelcaniello'
]

const TEAMS = {
  TODOS: concat(CMMS_PROJECT_TEAM_MEMBERS, CMMS_MAINTENANCE_TEAM_MEMBERS, FSM_PROJECT_TEAM_MEMBERS, FSM_MAINTENANCE_TEAM_MEMBERS),
  CMMS: concat(CMMS_PROJECT_TEAM_MEMBERS, CMMS_MAINTENANCE_TEAM_MEMBERS),
  'CMMS Projetos': CMMS_PROJECT_TEAM_MEMBERS,
  'CMMS Sustentação': CMMS_MAINTENANCE_TEAM_MEMBERS,
  FSM: concat(FSM_PROJECT_TEAM_MEMBERS, FSM_MAINTENANCE_TEAM_MEMBERS),
  'FSM Projetos': FSM_PROJECT_TEAM_MEMBERS,
  'FSM Sustentação': FSM_MAINTENANCE_TEAM_MEMBERS
}

export { TEAMS }
