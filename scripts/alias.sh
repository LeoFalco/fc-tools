function field () {
  nvm use $(cat ~/.fc-tools/.nvmrc) >> /dev/null
  node ~/.fc-tools $@
  nvm use &> /dev/null
}

function field-update () {
  curl https://raw.githubusercontent.com/LeoFalco/fc-tools/master/scripts/install.sh -s | sh
}
