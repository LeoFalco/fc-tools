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
  git pull >> /dev/null
  echo "▷ Updated fc-tools."
  cd - >> /dev/null
fi

. ~/.nvm/nvm.sh
recomended_node_version=$(cat ~/.fc-tools/.nvmrc)
nvm install $recomended_node_version
current_node_version=$(node -v)

if [ "$current_node_version" != "$recomended_node_version" ]; then
  echo "▷ Switching node version to $recomended_node_version..."
  nvm use $recomended_node_version >> /dev/null
  echo "▷ Switched node version to $recomended_node_version."
else
  echo "▷ Node version is $recomended_node_version."
fi

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

rm -rf ~/.fc-tools/data

echo "▷ fc-tools installed."
echo "▷ Restart your terminal to use fc-tools."

