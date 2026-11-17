# Qingzhou service namespace

Based on clash-verge-service-ipc v2.7.7, commit `3ed29700b093190b5e7addcaa892e77f172af544`.

The service name, app identity, IPC endpoints and execution locks use a separate Qingzhou namespace. The upstream authentication, ownership, executable validation and installation protections are retained. Bundled executable filenames remain compatible with the existing installer and client wrappers.
