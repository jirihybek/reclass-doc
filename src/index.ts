/**
 * Reclass doc generator
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 (c) 2017 Jiri Hybek
 */

import {Logger, LOG_LEVEL} from 'meta2-logger';
import pug = require('pug');
import fs = require('fs');
import path = require('path');
import {EventEmitter} from 'events';

import {Inventory, IInventoryConfig} from './Inventory';
import {Renderer, IRendererConfig} from './Renderer';
import {Server, IServerConfig} from './Server';

/**
 * Application configuration
 */
export interface IConfig {
	
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

/**
 * Application class
 */
export class ReclassDoc extends EventEmitter {

	/** Logger instance */
	protected logger: Logger;

	/** Inventory instance */
	protected inventory: Inventory;

	/** Renderer instance */
	protected renderer: Renderer;

	/** Server instance */
	protected server: Server = null;

	protected watchLock: boolean = false;

	/**
	 * Constructor
	 *
	 * @param config ReclassDoc configuration
	 * @param logger Logger instance
	 */
	public constructor(config: IConfig, logger: Logger){

		super();

		//Set default configuration
		config.outputDir = config.outputDir || (config.reclassDir + "/doc");
		config.classDir = config.classDir || '/classes';
		config.nodeDir = config.nodeDir || '/nodes';
		config.mediaSrcDir = config.mediaSrcDir || (config.reclassDir + "/util/media");
		config.mediaOutDir = config.mediaOutDir || "/media";
		config.assetsSrcDir = config.assetsSrcDir || "/assets/dist";
		config.assetsOutDir = config.assetsOutDir || "/assets";
		config.templateDir = config.templateDir || path.resolve(__dirname + "/../template");
		config.title = config.title || 'Reclass Reference';
		config.serverPort = config.serverPort || 8080;
		config.pugOptions = config.pugOptions || { pretty: true };
		config.globals = config.globals || {};
		config.logoUrl = config.logoUrl || null;

		if(config.watchReclass === undefined) config.watchReclass = true;
		if(config.watchMedia === undefined) config.watchMedia = true;
		if(config.watchTemplate === undefined) config.watchTemplate = true;

		if(config.startServer)
			config.globals['_watchChanges'] = true;

		//Init logger
		this.logger = logger;

		this.logger.debug("Using configuration:", config);

		//Init inventory
		this.inventory = new Inventory({
			reclassDir: config.reclassDir,
			classesDir: config.classDir,
			nodesDir: config.nodeDir
		}, this.logger.facility("Inventory"));

		//Init renderer
		this.renderer = new Renderer({
			outputDir: config.outputDir,
			nodesDir: config.nodeDir,
			classesDir: config.classDir,
			mediaSrcDir: config.mediaSrcDir,
			mediaOutDir: config.mediaOutDir,
			assetsSrcDir: config.assetsSrcDir,
			assetsOutDir: config.assetsOutDir,
			templateDir: config.templateDir,
			globals: config.globals,
			options: config.pugOptions,
			title: config.title,
			logoUrl: config.logoUrl
		}, this.inventory, this.logger.facility("Renderer"));

		//Setup server?
		if(config.startServer){

			this.server = new Server({
				outputDir: config.outputDir,
				port: config.serverPort
			}, this.logger.facility("Server"));

		}

		//Start watching changes?
		if(config.watch){

			if(config.watchReclass){

				this.watch(config.reclassDir + config.nodeDir);
				this.watch(config.reclassDir + config.classDir);

				if(fs.existsSync(config.reclassDir + "/README.md"))
					this.watch(config.reclassDir + "/README.md");
				
				if(fs.existsSync(config.reclassDir + "/readme.md"))
					this.watch(config.reclassDir + "/readme.md");

			}

			if(config.watchTemplate)
				this.watch(config.templateDir);

			if(config.watchMedia)
				this.watch(config.mediaSrcDir);

		}

	}

	/**
	 * Starts application
	 */
	public start(){

		this.emit("start");

		//Start server
		if(this.server)
			this.server.start();

		//Build documentation
		this.build();

	}

	/**
	 * Builds documentation
	 */
	public build(){

		this.logger.info("Building documentation...");

		//Load inventory

		this.logger.debug("Loading inventory...");

		this.inventory.load();

		let index = this.inventory.getIndex();
		let treeFinger = this.inventory.getTreeIndex();

		//Render documentation
		this.logger.debug("Rendering...");
		this.renderer.render(index, treeFinger);

		//Update server modification time
		if(this.server)
			this.server.setModified();

		this.emit("build");

	}

	/**
	 * Start watching for changes
	 *
	 * @param path Filename or directory to watch
	 */
	public watch(path: string){

		this.logger.info("Watching for changes of directory '" + path + "'...");

		let stat = fs.statSync(path);

		if(stat && stat.isDirectory()){

			fs.watch(path, { recursive: true }, () => {
				this.watchTrigger();
			});

		} else {

			fs.watch(path, () => {
				this.watchTrigger();
			});

		}

	}

	/**
	 * Called when watches items has changed
	 */
	protected watchTrigger(){

		this.logger.debug("Watch triggered.");

		if(this.watchLock) return;
		this.watchLock = true;

		this.logger.info("Some files changed, rebuilding...");

		setTimeout(() => {

			this.watchLock = false;
			this.logger.debug("Watch lock released.");

		}, 1);

		this.build();

		this.emit("watchChange");

	}

}