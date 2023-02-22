function field () {
  nvm use $(cat ~/.fc-tools/.nvmrc)
  node ~/.fc-tools $@
  nvm use
}

function field-update () {
  curl https://raw.githubusercontent.com/LeoFalco/fc-tools/master/scripts/install.sh -s | sh
}
