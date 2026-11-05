# customer-education-workshops

Public demos for customer education workshops. Each top-level folder is a standalone app — `cd` into it and install there. Demos do not share lockfiles or UI.

Smoke-test note: this line exists only so Bugbot can review a fresh pull request. Delete it after the check runs.

## Demos

| Folder | What | Run |
| --- | --- | --- |
| [`ledgerly/`](ledgerly/) | Fictional B2B billing ops (Fieldnote). Grok Build 101, 201, and 301 tracks. | `cd ledgerly && npm i && npx prisma generate && npx prisma db seed && npm run dev` → [http://localhost:43173](http://localhost:43173) |

See [`ledgerly/README.md`](ledgerly/README.md) for catalog prices, planted seams, and presenter notes (`demo-howto.md`).

## License

Apache License, Version 2.0. External contributions are not accepted — see [`CONTRIBUTING.md`](CONTRIBUTING.md).
