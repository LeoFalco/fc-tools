const CMMS_PROJECT_TEAM_MEMBERS = [
  'LeoFalco',
  'lilian-caballero',
  'tauk7',
  'cesarfield'
]

const CMMS_MAINTENANCE_TEAM_MEMBERS = [
  'eduamorimm',
  'pedroaugusto2002',
  'guilherme-carmona'
]

const FSM_PROJECT_TEAM_MEMBERS = [
  'caiorsantanna',
  'PedroHenriqueGazola',
  'matheusjurkovich',
  'Pedro-B-Siqueira'
]

const FSM_MAINTENANCE_TEAM_MEMBERS = [
  'AndreTrevizam',
  'Carlos-F-Braga',
  'rafaelcaniello',
  'Miguel01Santos',
  'LucasDelamura-Field',
  'CauanFelipeTavares',
  'claudiodeolli'
]

const QUALITY_TEAM = [
  'viniciusfantoli',
  'panegace',
  'giovanalmeida2',
  'QualidadeFieldControl'
]

const TEAMS = {
  TODOS: [...CMMS_PROJECT_TEAM_MEMBERS, ...CMMS_MAINTENANCE_TEAM_MEMBERS, ...FSM_PROJECT_TEAM_MEMBERS, ...FSM_MAINTENANCE_TEAM_MEMBERS].sort(),
  CMMS: [...CMMS_PROJECT_TEAM_MEMBERS, ...CMMS_MAINTENANCE_TEAM_MEMBERS].sort(),
  FSM: [...FSM_PROJECT_TEAM_MEMBERS, ...FSM_MAINTENANCE_TEAM_MEMBERS].sort(),
  'CMMS Projetos': CMMS_PROJECT_TEAM_MEMBERS.sort(),
  'CMMS Sustentação': CMMS_MAINTENANCE_TEAM_MEMBERS.sort(),
  'FSM Projetos': FSM_PROJECT_TEAM_MEMBERS.sort(),
  'FSM Sustentação': FSM_MAINTENANCE_TEAM_MEMBERS.sort()
}

const ALL_MEMBERS = [
  ...CMMS_PROJECT_TEAM_MEMBERS,
  ...CMMS_MAINTENANCE_TEAM_MEMBERS,
  ...FSM_PROJECT_TEAM_MEMBERS,
  ...FSM_MAINTENANCE_TEAM_MEMBERS,
  ...QUALITY_TEAM
].sort()

const duplicateMembers = ALL_MEMBERS.filter((item, index) => ALL_MEMBERS.indexOf(item) !== index)

if (duplicateMembers.length) {
  throw new Error(`There are duplicate members in the teams: ${[...new Set(duplicateMembers)].join(', ')}`)
}

export {
  TEAMS,
  QUALITY_TEAM
}
