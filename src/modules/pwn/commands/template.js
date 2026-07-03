module.exports = function template({ filePath }) {
  return `#!/usr/bin/env python3
from pwn import *

# Target
binary_path = '${filePath}'
elf = ELF(binary_path)

# Connection (change as needed)
# p = process(binary_path)
# p = remote('host', port)

# Exploit here
# payload = flat({
#     offset: address
# })

# p.interactive()
`;
};