/**
 * Reclass doc generator
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 (c) 2017 Jiri Hybek
 */

import fs = require('fs');
import crypto = require('crypto');
import {Facility} from 'meta2-logger';

import {Resolver, IResolvedClass} from './Resolver';
import {IClassName, parseClassName, CLASS_TYPE} from './Util';

/**
 * Inventory configuration interface
 */
export interface IInventoryConfig {
	reclassDir: string;
	classesDir?: string;
	nodesDir?: string;
}

/**
 * Inventory item interface
 */
export interface IInventoryClass {
	path: string;
	filename: string;
	name: IClassName;
	class?: IResolvedClass;
	error: Error;
}

/**
 * Inventory document interface
 */
export interface IInventoryDocument {
	path: string;
	filename: string;
	name: string;
	contents: Buffer|string;
	error: Error;
	fingerprint: string;
}

/**
 * Inventory index interface
 */
export interface IInventoryIndex {
	path: string;
	name: string;
	classes: { [K: string]: IInventoryClass };
	docs: { [K: string]: IInventoryDocument };
	dirs: { [K: string]: IInventoryIndex };
	fingerprint: string;
	contentFingerprint: string;
}

/**
 * Inventory class
 */
export class Inventory {

	/** Reclass root directory */
	protected reclassDir: string;

	/** Classes sub-directory */
	protected classesDir: string = '/classes';

	/** Nodes sub-directory */
	protected nodesDir: string = '/nodes';

	/** Resolver instance */
	protected resolver: Resolver;

	/** Logger facility */
	protected logger: Facility;

	/** Listed indexes */
	protected index: IInventoryIndex;

	/** Classess cache: id => inventoryClass */
	protected classCache: { [K: string]: IInventoryClass } = {};

	/** Nodes cache: id => inventoryClass */
	protected nodeCache: { [K: string]: IInventoryClass } = {};

	/** Tree overall index */
	protected treeIndex: string = null;

	/**
	 * Inventory constructor
	 *
	 * @param config Configuration object
	 * @param logger Logger facility instance
	 */
	public constructor(config: IInventoryConfig, logger: Facility){

		this.reclassDir = config.reclassDir;
		this.classesDir = config.classesDir || "/classes";
		this.nodesDir = config.nodesDir || "/nodes";

		//Setup resolver
		this.resolver = new Resolver(this.reclassDir);
		this.resolver.classesDir = this.classesDir;
		this.resolver.nodesDir = this.nodesDir;
		
		//Assign logger
		this.logger = logger;

		//Create root index
		this.index = {
			name: null,
			path: "__root__",
			classes: {},
			docs: {},
			dirs: {},
			fingerprint: null,
			contentFingerprint: null
		};

	}

	/**
	 * Resolves class and returns inventory object
	 *
	 * @param classPath Relative class path
	 * @param filename Class filename
	 * @param className Class name for resolver
	 */
	protected resolveClass(classPath: string, filename: string) : IInventoryClass {

		let className = parseClassName(CLASS_TYPE.CLASS, classPath);

		this.logger.info("Reading class '" + classPath + "' as '" + className.fullName + "'...");

		let rClass: IInventoryClass = {
			path: classPath,
			filename: filename,
			name: className,
			class: null,
			error: null
		};

		try {

			rClass.class = this.resolver.resolveClass(className.fullName);

		} catch(err) {

			rClass.error = err;
			
			this.logger.warn("Failed to load class '" + filename + "':", String(err), err.stack);

		}

		this.classCache[ className.fullName ] = rClass;

		return rClass;

	}

	/**
	 * Resolves node and returns inventory object
	 *
	 * @param nodePath Relative node path
	 * @param filename Node filename
	 * @param nodeName Node name for resolver
	 */
	protected resolveNode(nodePath: string, filename: string) : IInventoryClass {

		let nodeName = parseClassName(CLASS_TYPE.NODE, nodePath);

		this.logger.info("Reading node '" + nodePath + "' as '" + nodeName.fullName + "'...");

		let rClass: IInventoryClass = {
			path: nodePath,
			filename: filename,
			name: nodeName,
			class: null,
			error: null
		};

		try {

			rClass.class = this.resolver.resolveNode(nodeName.fullName);

		} catch(err) {

			rClass.error = err;
			
			this.logger.warn("Failed to load node '" + filename + "':", String(err));

		}

		this.nodeCache[nodeName.fullName] = rClass;

		return rClass;

	}

	/**
	 * Resolves document and returns inventory object
	 *
	 * @param docPath Relative document path
	 * @param filename Class filename
	 * @param name Document name
	 */
	protected resolveDocument(docPath: string, filename: string, name: string) : IInventoryDocument {

		this.logger.info("Reading document '" + docPath + "'...");

		let rDoc = {
			path: docPath,
			filename: filename,
			name: name,
			contents: null,
			error: null,
			fingerprint: null
		};

		try {

			rDoc.contents = fs.readFileSync(filename, { encoding: 'utf-8' });

			let stat = fs.statSync(filename);

			rDoc.fingerprint = crypto.createHash('md5').update(name + ":" + stat.mtime.getTime()).digest('hex');

		} catch(err) {

			rDoc.error = err;
			
			this.logger.warn("Failed to load document '" + filename + "':", String(err));

		}

		return rDoc;

	}

	/**
	 * Calculates index fingerprint
	 *
	 * @param index Inventory index
	 */
	protected fingerprintIndex(index: IInventoryIndex){

		let hashStr = [ index.name ];

		for(let i in index.classes)
			hashStr.push("cls:" + index.classes[i].name);

		for(let i in index.docs)
			hashStr.push("doc:" + index.docs[i].name);

		for(let i in index.dirs)
			hashStr.push("dir:" + index.dirs[i].name);

		index.fingerprint = crypto.createHash('md5').update(hashStr.join(",")).digest('hex');

		if(index.classes["init"])
			hashStr.push("init:" + index.classes["init"].class.fingerprint);

		if(index.docs["README"])
			hashStr.push("readme:" + index.docs["README"].fingerprint);

		index.contentFingerprint = crypto.createHash('md5').update(hashStr.join(",")).digest('hex');

	}

	/**
	 * Scans directory and read classes
	 *
	 * @param dir Relative classes directory
	 * @param name Directory name
	 */
	protected readClasses(dir: string, name: string) : IInventoryIndex {

		let path = this.reclassDir + this.classesDir + dir;

		this.logger.debug("Reading directory '%s'...", path);

		//Create index
		let index: IInventoryIndex = {
			name: name,
			path: this.classesDir + dir,
			classes: {},
			docs: {},
			dirs: {},
			fingerprint: null,
			contentFingerprint: null
		};

		//Iterate over files
		let files = fs.readdirSync(path);

		for(let i = 0; i < files.length; i++){

			let file = files[i];
			let filePath = path + "/" + file;

			if(file == "." || file == "..") continue;

			this.logger.debug("Checking '%s'...", filePath);

			//Is directory?
			if(fs.statSync(filePath).isDirectory()){

				index.dirs[file] = this.readClasses(dir + "/" + file, file);

			//Is file
			} else {

				//Get file extension
				let fileExt = new RegExp(/^(.+)\.(yaml|yml|md|YAML|YML|MD)$/);
				let match = fileExt.exec(file);

				//Skip if not matched
				if(!match) continue;

				let basename = match[1];
				let ext = String(match[2]).toLowerCase();

				//Is doc?
				if(ext == "md"){

					let docPath = this.classesDir + dir + ( basename.toLowerCase() != "readme" ? "/" + basename : "" );
					let docName = ( basename.toLowerCase() == "readme" ? "README" : basename );
					
					index.docs[docName] = this.resolveDocument(docPath, filePath, docName);

				//Is YAML
				} else if(ext == "yml" || ext === "yaml") {

					let classPath = dir + "/" + basename;

					index.classes[basename] = this.resolveClass(classPath, filePath);

				}

			}

		}

		//Update fingerprint
		this.fingerprintIndex(index);

		return index;

	}

	/**
	 * Scans directory and read nodes
	 *
	 * @param dir Relative nodes directory
	 * @param name Directory name
	 */
	protected readNodes(dir: string, name: string) : IInventoryIndex {

		let path = this.reclassDir + this.nodesDir + dir;

		//Create index
		let index: IInventoryIndex = {
			name: name,
			path: this.nodesDir + dir,
			classes: {},
			docs: {},
			dirs: {},
			fingerprint: null,
			contentFingerprint: null
		};

		//Iterate over files
		let files = fs.readdirSync(path);

		this.logger.debug("Reading directory '%s'...", path);

		for(let i = 0; i < files.length; i++){

			let file = files[i];
			let filePath = path + "/" + file;

			if(file == "." || file == "..") continue;

			this.logger.debug("Checking '%s'...", filePath);

			//Is directory?
			if(fs.statSync(filePath).isDirectory()){

				this.readNodes(dir + "/" + file, file);

			//Is file
			} else {

				//Get file extension
				let fileExt = new RegExp(/^(.+)\.(yaml|yml|md|YAML|YML|MD)$/);
				let match = fileExt.exec(file);

				//Skip if not matched
				if(!match) continue;

				let basename = match[1];
				let ext = String(match[2]).toLowerCase();

				//Is doc?
				if(ext == "md"){

					let docPath = this.nodesDir + dir + ( basename.toLowerCase() != "readme" ? "/" + basename : "" );
					let docName = ( basename.toLowerCase() == "readme" ? "README" : basename );
					
					index.docs[docName] = this.resolveDocument(docPath, filePath, docName);

				//Is YAML
				} else if(ext == "yml" || ext === "yaml") {

					let classPath = dir + "/" + basename;

					index.classes[basename] = this.resolveNode(classPath, filePath);

				}

			}

		}

		//Update fingerprint
		this.fingerprintIndex(index);

		return index;

	}

	/**
	 * Loads classes in model
	 */
	protected loadClasses(){

		this.index.dirs["classes"] = this.readClasses("", "classes");

	}

	/**
	 * Loads nodes in model
	 */
	protected loadNodes(){

		this.index.dirs["nodes"] = this.readNodes("", "nodes");

	}

	/**
	 * Calculates fingerprint of index and all dirs
	 *
	 * @param index Inventory index
	 */
	protected fingerprintTree(index: IInventoryIndex) : string {

		let hashStr = [ index.fingerprint ];

		for(let i in index.dirs)
			hashStr.push( this.fingerprintTree(index.dirs[i]) );

		return crypto.createHash('md5').update(hashStr.join(",")).digest('hex');

	}

	/**
	 * Loads inventory
	 */
	public load(){

		this.resolver.invalidateModified();

		this.loadClasses();
		this.loadNodes();

		//Load readme
		let readmePath;

		if(fs.existsSync(this.reclassDir + "/README.md"))
			readmePath = "/README.md";
		else if(fs.existsSync(this.reclassDir + "readme.md"))
			readmePath = "/readme.md";

		if(readmePath)
			this.index.docs['README'] = this.resolveDocument(readmePath, this.reclassDir + readmePath, "README");

		this.fingerprintIndex(this.index);

		this.treeIndex = this.fingerprintTree(this.index);

	}

	/**
	 * Returns loaded indexes
	 */
	public getIndex(){

		return this.index;

	}

	/**
	 * Returns tree index
	 */
	public getTreeIndex(){

		return this.treeIndex;

	}

	/**
	 * Returns reference to cached class
	 *
	 * @param className Class name
	 */
	public getClassRef(className: string){

		return this.classCache[className];

	}

	/**
	 * Returns reference to cached node
	 *
	 * @param nodeName Node name
	 */
	public getNodeRef(nodeName: string){

		return this.nodeCache[nodeName];

	}

}