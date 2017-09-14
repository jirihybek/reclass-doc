# reclass-doc

Reclass documentation generator.

**Generates HTML documentation of Reclass model including:**

- Nodes
- Classes
- README.md files from model directories
- init.yml files
- Source files with syntax highlighting
- Comments parsed from YAML files
- Class search
- Property search
- Property inheritance

**Each class contains information about:**

- Dependencies (included classes)
- Dependents (which classes include current class)
- Applications
- Properties
- Merge tracking (from where each property has been merged)
- Interpolated properties

## Installation

1. Install [Node.js](https://nodejs.org/en/download/) with NPM
2. Run `npm install reclass-doc`

## Usage

```bash
usage: reclass-doc [-h] [-v] [--output OUTPUT_DIR] [--media-dir MEDIA_DIR]
                   [--node-dir NODE_DIR] [--class-dir CLASS_DIR]
                   [--template TEMPLATE_DIR] [--config CONFIG_FILE] [-w] [-s]
                   [--port PORT] [--verbose {log,debug,info,warn,error}]
                   reclass_dir

Positional arguments:
  reclass_dir                            Reclass directory

Optional arguments:
  -h, --help                             Show this help message and exit.
  -v, --version                          Show program's version number and exit.
  --output OUTPUT_DIR                    Output directory
  --media-dir MEDIA_DIR                  Media dir
  --node-dir NODE_DIR                    Reclass node sub-directory
  --class-dir CLASS_DIR                  Reclass classes sub-directory
  --template TEMPLATE_DIR                Template dir
  --config CONFIG_FILE                   Config JSON filename
  -w                                     Dynamically watch for changes and rebuild
  -s                                     Start express server
  --port PORT                            Server port
  --verbose {log,debug,info,warn,error}  Logging verbose level
```

**Example:**

```bash
cd ./reclass_root_dir

# Build documentation into reclass_root_dir/doc
reclass-doc

# Build documentation into ./my-reclass-doc and use ./my-reclass-root as Reclass root directory
reclass-doc --output ./my-reclass-doc ./my-reclass-root
```

## Demo

You can build demo documentation yourself by cloning this repository and executing `reclass-doc ./demo-reclass`.

![Screenshots](https://raw.githubusercontent.com/jirihybek/reclass-doc/master/screenshots.jpg "reclass-doc screenshots")

## Configuration File

Configuration filename is set to `<reclass_root>/reclass-config.json` unless specified using `--config` flag.

Following configuration options can be set in configuration file.

```typescript
{
	
	/** Reclass root directory */
	reclassDir: string;
	
	/** Documentation output directory */
	outputDir?: string;

	/** Nodes directory in reclass root dir */
	nodeDir?: string;

	/** Classes directory in reclass root dir */
	classDir?: string;

	/** Template directory */
	templateDir?: string;

	/** Media source directory to be copied to documentation output */
	mediaSrcDir?: string;

	/** Media directory relative to documentation output */
	mediaOutDir?: string;

	/** Assets source directory relative to template dir */
	assetsSrcDir?: string;

	/** Assets destination directory relative to documentation output */
	assetsOutDir?: string;

	/** Template globals */
	globals?: { [K: string]: any };
	
	/** PUG options */
	pugOptions?: pug.Options;
	
	/** Documentation title */
	title?: string;

	/** Documentation logo url */
	logoUrl?: string;

	/** If to start express server */
	startServer?: boolean;

	/** Express server port */
	serverPort?: number;

	/** If to watch changes and rebuild documentation automatically */
	watch?: boolean;

	/** If to watch for reclass dir changes */
	watchReclass?: boolean;

	/** If to watch for template changes */
	watchTemplate?: boolean;

	/** If to watch for media directory changes */
	watchMedia?: boolean;

	/** Logger log level */
	logLevel?: LOG_LEVEL;

}
```

## Custom template

You can create your own template and specify path to it using `--template` flag or `templateDir` config property.

Reclass-doc is using [pug](https://pugjs.org) as templating engine.

See `template` directory in this repository for more information.

## License

Copyright 2017 Jiri Hybek <jiri@hybek.cz>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.