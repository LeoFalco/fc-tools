#! usr/bin/sh

echo "▷ Installing fc-tools..."

# if fc-tools directory not exists
if [ ! -d ~/.fc-tools ]; then
  echo "▷ Cloning fc-tools..."
  git clone https://github.com/LeoFalco/fc-tools.git ~/.fc-tools --depth 1
  echo "▷ Cloned fc-tools."
else
  echo "▷ fc-tools already cloned."
  cd ~/.fc-tools
  echo "▷ Updating fc-tools..."

  git fetch --all >> /dev/null
  git reset --hard origin/master
  git pull

  echo "▷ Updated fc-tools."
  cd - >> /dev/null
fi

. ~/.nvm/nvm.sh
nvm use $(cat ~/.fc-tools/.nvmrc) || nvm install $(cat ~/.fc-tools/.nvmrc)

cd ~/.fc-tools
echo "▷ Installing dependencies..."
npm install >> /dev/null
echo "▷ Installed dependencies."
git add -A
git reset --hard >> /dev/null
cd - >> /dev/null

if [ -f ~/.bashrc ]; then
  if ! grep -q "fc-tools" ~/.bashrc; then
    echo "▷ Adding fc-tools to bashrc..."
    echo "\nsource ~/.fc-tools/scripts/alias.sh" >> ~/.bashrc
    echo "▷ Added fc-tools to bashrc."
  else
    echo "▷ fc-tools already added to bashrc."
  fi
fi

if [ -f ~/.zshrc ]; then
  if ! grep -q "fc-tools" ~/.zshrc; then
    echo "▷ Adding fc-tools to zshrc..."
    echo
    echo "\nsource ~/.fc-tools/scripts/alias.sh" >> ~/.zshrc
    echo "▷ Added fc-tools to zshrc."
  else
    echo "▷ fc-tools already added to zshrc."
  fi
fi

if [ -f ~/.config/fish/config.fish ]; then
  if ! grep -q "fc-tools" ~/.config/fish/config.fish; then
    echo "▷ Adding fc-tools to fish..."
    echo "\nsource ~/.fc-tools/scripts/alias.fish.sh" >> ~/.config/fish/config.fish
    echo "▷ Added fc-tools to fish."
  else
    echo "▷ fc-tools already added to fish."
  fi
fi

echo "▷ fc-tools installed."
echo "▷ Restart your terminal to use fc-tools."

