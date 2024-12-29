with open("pwn.wasm", "rb") as f:
    wasm = f.read()

wasm_src = "["
for i in range(len(wasm)):
    wasm_src += hex(wasm[i])
    if i < len(wasm) - 1:
        wasm_src += ", "
    else:
        wasm_src += "]"

print(wasm_src)
