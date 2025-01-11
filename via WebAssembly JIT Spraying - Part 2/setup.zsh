#!/bin/zsh

# install depot_tools
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git ~/depot_tools
echo "
export PATH=\$HOME/depot_tools:\$PATH
export NINJA_SUMMARIZE_BUILD=1" >>~/.zshrc
source ~/.zshrc

# get v8
mkdir ~/v8
git clone https://chromium.googlesource.com/v8/v8.git ~/v8/v8
cd ~/v8/v8
git checkout 8cf17a14a78cc1276eb42e1b4bb699f705675530

# sync submodules
cd ..
echo 'solutions = [
  {
    "name": "v8",
    "url": "https://chromium.googlesource.com/v8/v8.git",
    "deps_file": "DEPS",
    "managed": False,
    "custom_deps": {},
  },
]' >.gclient
gclient sync -D

# install dependencies
cd v8
./build/install-build-deps.sh

# install gdb plugin
echo "
source $HOME/v8/v8/tools/gdbinit" >>~/.gdbinit

# build v8
gn gen out/debug --args='target_os="linux" target_cpu="x64" v8_expose_memory_corruption_api=true is_component_build=false v8_optimized_debug=false'
gn gen out/release --args='target_os="linux" target_cpu="x64" v8_expose_memory_corruption_api=true is_debug=false'
autoninja -C out/debug d8
autoninja -C out/release d8

# wabt
git clone --recursive https://github.com/WebAssembly/wabt ~/wabt
cd ~/wabt
git submodule update --init
mkdir build
cd build
cmake ..
cmake --build .
