# Sample Reclass Project

This project demonstrates sample web-server stack meta-data using [salt-formulas](https://github.com/salt-formulas).

## How to Build this Reclass Doc

1. Install [Node.js](https://nodejs.org/en/download/) with NPM
2. Run `npm install -g reclass-doc`
3. Run `reclass-doc` from reclass directory.

## Project Structure

- `/class` - Reclass classes directory
- `/nodes` - Reclass nodes directory
- `/util` - Contains `media` directory

### Classes

**`/service`** Directory

Contains salt-formulas meta-data. These should be linked from installed formulas in producton.

**`/system`** Directory

Contains system-level modules. See [salt-formulas concept](https://salt-formulas.readthedocs.io/en/latest/develop/overview-mda.html) for more information.

**`/cluster`** Directory

Contains sample cluster-level configuration.

### Nodes

This demo consists of 3 servers:

- MySQL Server
- Web Server 1
- Web Server 2