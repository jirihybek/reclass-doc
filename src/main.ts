#!/usr/bin/env node

/**
 * Reclass doc generator
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 (c) 2017 Jiri Hybek
 */

import fs = require('fs');
import {ArgumentParser} from 'argparse';
import {Logger, LOG_LEVEL} from 'meta2-logger';
import {parseLogLevel} from './Util';

import {ReclassDoc, IConfig} from './index';

/*
 * Setup argument parser
 */
var parser = new ArgumentParser({
	version: '1.0.0',
	addHelp:true,

});

parser.addArgument( [ '--output' ], {
	help: 'Output directory',
	dest: 'output_dir'
});

parser.addArgument( [ '--media-dir' ], {
	help: 'Media dir',
	dest: 'media_dir'
});

parser.addArgument( [ '--node-dir' ], {
	help: 'Reclass node sub-directory',
	dest: 'node_dir'
});

parser.addArgument( [ '--class-dir' ], {
	help: 'Reclass classes sub-directory',
	dest: 'class_dir'
});

parser.addArgument( [ '--template' ], {
	help: 'Template dir',
	dest: 'template_dir'
});

parser.addArgument( [ '--config' ], {
	help: 'Config JSON filename',
	dest: 'config_file'
});

parser.addArgument( [ '-w' ], {
	help: 'Dynamically watch for changes and recompile',
	dest: 'watch',
	action: 'storeTrue'
});

parser.addArgument( [ '-s' ], {
	help: 'Start express server',
	dest: 'server',
	action: 'storeTrue'
});

parser.addArgument( [ '--port' ], {
	help: 'Server port',
	dest: 'port',
	defaultValue: 8080
});

parser.addArgument( [ '--verbose' ], {
	help: 'Logging verbose level',
	dest: 'log_level',
	choices: [ "log", "debug", "info", "warn", "error" ],
	defaultValue: "info"
});

parser.addArgument( ["reclass_dir"], {
	help: 'Reclass directory',
	defaultValue: ".",
	nargs: "*"
});

//Parse args
let args = parser.parseArgs();

try {

	//Init logger
	let logger = new Logger();
	let logLevel = parseLogLevel(args.log_level) || LOG_LEVEL.INFO;

	logger.toConsole({
		level: logLevel,
		colorize: true,
		timestamp: false
	});

	logger.debug("CLI args", args);

	try {

		let config: IConfig = <any>{};
		let reclassDir = ( args.reclass_dir && args.reclass_dir.length > 0 ? args.reclass_dir[0] : "." );
		let configFilename = args.config_file || ( reclassDir + "/reclass-doc.json" );

		//Load config file
		if(fs.existsSync( configFilename )){

			logger.info("Reading configuration from '" + configFilename + "'...");

			let configFile = fs.readFileSync(configFilename, { encoding: 'utf-8' });
			config = JSON.parse(configFile);

			if(!( config instanceof Object ))
				throw new Error("Invalid configuration file structure.");

		} else {

			logger.warn("No config file '" + configFilename + "' found, using default values.");

		}

		//Merge flags to config
		if(args.output_dir) config.outputDir = args.output_dir;
		if(args.media_dir) config.mediaSrcDir = args.media_dir;
		if(args.node_dir) config.nodeDir = args.node_dir;
		if(args.class_dir) config.classDir = args.class_dir;
		if(args.template_dir) config.templateDir = args.template_dir;
		if(args.watch) config.watch = true;
		if(args.server) config.startServer = true;
		if(args.port) config.serverPort = parseInt(args.port);
		if(args.reclass_dir) config.reclassDir = reclassDir;

		//Init application
		logger.debug("Initializing ReclassDoc...");

		let app = new ReclassDoc(config, logger);

		logger.info("Starting ReclassDoc...");

		app.start();

	} catch(err){

		if(logLevel === LOG_LEVEL.BREAK || logLevel === LOG_LEVEL.DEBUG)
			logger.error(err, err.stack);
		else
			logger.error(err);

	}

} catch(err) {

	console.error(err);

}