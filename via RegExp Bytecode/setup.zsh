#!/bin/zsh

# install depot_tools
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git ~/depot_tools
echo "
export PATH=\$HOME/depot_tools:\$PATH
export NINJA_SUMMARIZE_BUILD=1" >> ~/.zshrc
source ~/.zshrc

# get v8
mkdir ~/v8
git clone https://chromium.googlesource.com/v8/v8.git ~/v8/v8
cd ~/v8/v8
git checkout 0c1231b6414d19468d6f7a35ff5b6167626f57a5

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
]' > .gclient
gclient sync -D

# install dependencies
cd v8
# ./build/install-build-deps.sh
sudo apt install -y binutils binutils-aarch64-linux-gnu binutils-arm-linux-gnueabihf binutils-mips64el-linux-gnuabi64 binutils-mipsel-linux-gnu bison bzip2 cdbs curl dbus-x11 devscripts dpkg-dev elfutils fakeroot flex git-core gperf lib32gcc-s1 lib32stdc++6 lib32z1 libasound2-dev libatk1.0-0 libatspi2.0-0 libatspi2.0-dev libbluetooth-dev libbrlapi-dev libbrlapi0.8 libbz2-1.0 libbz2-dev libc6 libc6-dev libc6-i386 libcairo2 libcairo2-dev libcap-dev libcap2 libcgi-session-perl libcups2 libcups2-dev libcurl4-gnutls-dev libdrm-dev libdrm2 libegl1 libelf-dev libevdev-dev libevdev2 libexpat1 libffi-dev libffi8 libfontconfig1 libfreetype6 libfuse2 libgbm-dev libgbm1 libgl1 libglib2.0-0 libglib2.0-dev libglu1-mesa-dev libgtk-3-0 libgtk-3-dev libinput-dev libinput10 libjpeg-dev libkrb5-dev libncurses6 libnspr4 libnspr4-dev libnss3 libnss3-dev libpam0g libpam0g-dev libpango-1.0-0 libpangocairo-1.0-0 libpci-dev libpci3 libpcre3 libpixman-1-0 libpulse-dev libpulse0 libsctp-dev libspeechd-dev libspeechd2 libsqlite3-0 libsqlite3-dev libssl-dev libstdc++6 libsystemd-dev libudev-dev libudev1 libuuid1 libva-dev libvulkan-dev libvulkan1 libwayland-egl1 libwayland-egl1-mesa libwww-perl libx11-6 libx11-xcb1 libxau6 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxdmcp6 libxext6 libxfixes3 libxi6 libxinerama1 libxkbcommon-dev libxrandr2 libxrender1 libxshmfence-dev libxslt1-dev libxss-dev libxt-dev libxtst-dev libxtst6 lighttpd locales mesa-common-dev openbox p7zip patch perl pkg-config rpm ruby subversion uuid-dev wdiff x11-utils xcompmgr xserver-xorg-core xserver-xorg-video-dummy xvfb xz-utils zip zlib1g zstd

# install gdb plugin
echo "
source $HOME/v8/v8/tools/gdbinit" >> ~/.gdbinit

# build v8
gn gen out/debug --args='target_os="linux" target_cpu="x64" v8_enable_memory_corruption_api=true is_component_build=false v8_optimized_debug=false'
gn gen out/release --args='target_os="linux" target_cpu="x64" v8_enable_memory_corruption_api=true is_debug=false'
autoninja -C out/debug d8
autoninja -C out/release d8
