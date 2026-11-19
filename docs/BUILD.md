# Build ExecOS

The kernel is built under Ubuntu on WSL2 using the repository's Limine-based
GNU Make build. The commands below have been run from the project root in WSL.

Install the required packages:

```sh
sudo apt update
sudo apt install build-essential git curl xorriso qemu-system-x86
```

Build the bootable ISO:

```sh
make
```

The build creates `execos.iso` in the project root. `make` may obtain the
Limine protocol dependencies through the kernel's existing build rules. The
kernel currently builds as freestanding x86-64 code with the configured host
GNU toolchain; no separate cross-compiler is required by the verified build.

For this checkout, run the build from Windows PowerShell using WSL Ubuntu:

```powershell
wsl -d Ubuntu -- make -C '/mnt/c/Users/VEDANTI KADAM/OneDrive/Documents/Desktop/ExecOS'
```

For another checkout, replace the path with that repository's WSL-mounted
location.
