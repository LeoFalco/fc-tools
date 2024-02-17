function field
  nvm use (cat ~/.fc-tools/.nvmrc) >> /dev/null
  node ~/.fc-tools $argv
  nvm use &> /dev/null
end


function field-update
  curl https://raw.githubusercontent.com/LeoFalco/fc-tools/master/scripts/install.sh -s | sh
end