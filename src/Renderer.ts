/**
 * Reclass doc generator
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 (c) 2017 Jiri Hybek
 */

import fs = require('fs');
import fsExtra = require("fs-extra");

import pug = require('pug');
import markdownIt = require('markdown-it');
import hljs = require('highlight.js');

import {Facility} from 'meta2-logger';

import {IResolvedClass, IDependencyClass, IResolvedParam, IResolvedSource, MERGE_TYPE} from './Resolver';
import {Inventory, IInventoryIndex, IInventoryClass, IInventoryDocument} from './Inventory';
import {TOKEN_TYPE} from './YamlTokenizer';
import {merge, IClassName, CLASS_TYPE} from './Util';

/**
 * Navigation tree interface
 */
interface INavItem {
	label: string;
	type: string;
	link: string;
	id: string;
	items: Array<INavItem>;
	flags: { [K: string]: boolean };
	fulltext: string;
}

/**
 * Page section interface
 */
interface ISection {
	title?: string;
	type: string;
}

/**
 * Text section interface
 */
interface ITextSection extends ISection {
	contents: string;
	sourceLink?: string;
	errors?: Array<string|Error>;
}

/**
 * Class link interface
 */
interface IClassLink {
	className: string;
	link: string;
	dependencies: Array<IClassLink>;
	flags: { [K: string]: string };
}

/**
 * Class property source interface
 */
interface IClassPropSource {
	className: string;
	classLink: string;
	sourceLink: string;
	type: string;
	mergeType: string;
	value: any;
	comment: string;
}

/**
 * Class property ref interface
 */
interface IClassPropRef {
	name: string;
	link: string;
}

/**
 * Class property interface
 */
interface IClassProp {
	id: string;
	name: string;
	sources: Array<IClassPropSource>;
	type: string;
	ownProp: boolean;
	value: any;
	ref: Array<IClassPropRef>;
	comment: Array<string>;
	fulltext: string;
}

/**
 * Class application source interface
 */
interface IClassAppSource {
	className: string;
	classLink: string;
	sourceLink: string;
	comment: string;
}

/**
 * Class application interface
 */
interface IClassApp {
	name: string;
	sources: Array<IClassAppSource>;
	comment: Array<string>;
	ownProp: boolean;
}

/**
 * Class interface
 */
interface IClass {
	className: string;
	dependencies: Array<IClassLink>;
	dependents: Array<IClassLink>;
	applications: Array<IClassApp>;
	props: IClassProp;
}

/**
 * Class section interface
 */
interface IClassSection extends ISection {
	class: IClass;
	sourceLink: string;
	errors: Array<string|Error>;
}

/**
 * Source code section interface
 */
interface ISourceSection extends ISection {
	contents: string;
}

/**
 * Class list section
 */
interface IClassListSection extends ISection {
	classes: Array<{
		label: string;
		link: string;
		flags: { [K: string]: string }
	}>;
}

/**
 * Crumb interface
 */
interface ICrumb {
	label: string;
	link: string;
}

/**
 * Page interface
 */
interface IPage {
	title: string;
	label: string;
	sections: Array<ISection>;
	crumbs: Array<ICrumb>;
	type: string;
	id: string;
}

interface IIndexPage {
	title: string;
	label: string;
	sections: { [K: string]: ISection };
	crumbs: Array<ICrumb>;
	type: string;
	id: string;
}

/**
 * Renderer configuration interface
 */
export interface IRendererConfig {
	outputDir: string;
	templateDir: string;
	classesDir?: string;
	nodesDir?: string;
	sourcePostfix?: string;
	assetsSrcDir?: string;
	assetsOutDir?: string;
	mediaSrcDir?: string;
	mediaOutDir?: string;
	globals?: { [K: string]: any };
	options?: pug.Options;
	title?: string;
	logoUrl?: string;
}

/**
 * Renderer class
 */
export class Renderer {

	/** Output directory */
	protected outputDir: string;

	/** Classes output directory */
	protected classesDir: string;

	/** Nodes output directory */
	protected nodesDir: string;

	/** Source file postfix */
	protected sourcePostfix: string;

	/** Template directory */
	protected templateDir: string;

	/** Assets source directory */
	protected assetsSrcDir: string;

	/** Assets output directory */
	protected assetsOutDir: string;

	/** Media source directory */
	protected mediaSrcDir: string;

	/** Media output directory */
	protected mediaOutDir: string;

	/** Global variables for templates */
	protected globals: { [K: string]: any };

	/** Pug options */
	protected options: pug.Options;

	/** Inventory instance */
	protected inventory: Inventory;

	/** Logger facility */
	protected logger: Facility;

	/** Inventory item cache - path => fingerprint */
	protected cache: { [K: string]: string } = {};

	protected tplCache: { [K: string]: any } = {};

	/** Markdown renderer */
	protected markdown: markdownIt.MarkdownIt;

	/**
	 * Renderer constructor
	 *
	 * @param config Renderer config
	 * @param logger Logger facility
	 */
	public constructor(config: IRendererConfig, inventory: Inventory, logger: Facility){

		this.outputDir = config.outputDir;
		this.classesDir = config.classesDir || '/classes';
		this.nodesDir = config.nodesDir || '/nodes';
		this.sourcePostfix = config.sourcePostfix || '.source';

		this.templateDir = config.templateDir;
		this.assetsSrcDir = config.assetsSrcDir || '/assets/dist';
		this.assetsOutDir = config.assetsOutDir || '/assets';

		this.mediaSrcDir = config.mediaSrcDir || '/media';
		this.mediaOutDir = config.mediaOutDir || '/media';

		this.globals = config.globals || {};
		this.options = config.options || {
			pretty: true
		};

		this.globals.siteTitle = config.title || 'Reclass reference';
		this.globals.siteLogo = config.logoUrl || null;

		this.inventory = inventory;
		this.logger = logger;

		this.markdown = new markdownIt({
			highlight: (str, lang) => {
				if (lang && hljs.getLanguage(lang)) {
					try {
						return hljs.highlight(lang, str).value;
					} catch (__) {}
				}

				return ''; // use external default escaping
			}
		});

	}

	/**
	 * Filters output html
	 *
	 * @param html Rendered html
	 * @param path Current path
	 */
	protected filterOutput(html: string, path: string){

		let _path = path.split("/");
		let basePathParts = [];

		if(path != ""){
			
			_path.pop();

			for(let i in _path)
				if(_path[i].trim() != "")
					basePathParts.push("..");

		}

		let basePath = basePathParts.length > 0 ?  "./" + basePathParts.join("/") : ".";

		html = html.replace(/{{base}}/g, basePath);
		html = html.replace(/{{media}}/g, basePath + "/" + this.mediaOutDir);

		return html;

	}

	/**
	 * Renders template
	 *
	 * @param templateName Template name
	 * @param locals Local vars
	 */
	protected renderTpl(templateName: string, locals: { [K: string]: any } = {}){

		let tpl = this.tplCache[templateName];

		if(!tpl)
			tpl = this.tplCache[templateName] = pug.compileFile(this.templateDir + "/" + templateName + ".pug", this.options);

		return tpl(merge(this.globals, locals));

	}

	/**
	 * Generates link to class page
	 *
	 * @param className Class name
	 */
	protected getClassLink(className: IClassName){

		let prefixDir = ( className.type == CLASS_TYPE.NODE ? this.nodesDir : this.classesDir );
		let classPath, localName;

		if(className.type == CLASS_TYPE.CLASS){
			classPath = className.fullName.split(".");
			localName = classPath.pop();
		} else {
			classPath = className.fullName.split("/");
			localName = classPath.pop();
		}

		return "{{base}}" + prefixDir + ( classPath.length > 0 ? "/" + classPath.join("/") : "" ) + ( className.isInit ? "/" + localName + "/index.html" : "/class." + localName + ".html" );

	}

	/**
	 * Generates link to class source page
	 *
	 * @param className Class name
	 */
	protected getClassSourceLink(className: IClassName){

		let prefixDir = ( className.type == CLASS_TYPE.NODE ? this.nodesDir : this.classesDir );
		let classPath, localName;

		if(className.type == CLASS_TYPE.CLASS){
			classPath = className.fullName.split(".");
			localName = classPath.pop();
		} else {
			classPath = className.fullName.split("/");
			localName = classPath.pop();
		}

		return "{{base}}" + prefixDir + ( classPath.length > 0 ? "/" + classPath.join("/") : "" ) + ( className.isInit ? "/" + localName + "/init.source.html" : "/class." + localName + ".source.html" );

	}

	/**
	 * Generates document link
	 *
	 * @param path Directory path
	 * @param name Document name
	 */
	protected getDocumentLink(path: string, name: string){

		return "{{base}}" + path + "/doc." + name + ".html";

	}

	/**
	 * Generates document link
	 *
	 * @param path Directory path
	 * @param name Document name
	 */
	protected getDocumentSourceLink(path: string){

		return "{{base}}" + path + ".source.html";

	}

	/**
	 * Generates link to directory index
	 *
	 * @param path Path
	 */
	protected getDirectoryLink(path: string){

		return "{{base}}" + path + "/index.html";

	}

	/**
	 * Prepares navigation tree for template
	 *
	 * @param index Inventory index
	 * @param path Relative path
	 */
	protected prepareTree(index: IInventoryIndex, path: string = '') : INavItem {

		//Create nav item
		let item : INavItem = {
			type: ( index.classes['init'] ? 'class' : 'directory' ),
			label: index.name,
			link: "{{base}}" + path + "/index.html",
			id: "dir:" + path,
			items: [],
			flags: {},
			fulltext: [ index.name, path, path.replace(/\//g, ' ') ].join(" ")
		};

		if( (index.classes['init'] && index.classes['init'].error) || ( index.docs['README'] && index.docs['README'].error ) )
			item.flags['error'] = true;

		//Add classes
		for(let i in index.classes)
			if(i !== 'init')
				item.items.push({
					type: 'class',
					label: index.classes[i].name.name,
					link: this.getClassLink(index.classes[i].name),
					id: "class:" + index.classes[i].name.fullName,
					items: null,
					flags: ( index.classes[i].error ? { "error": true } : {} ),
					fulltext: [ index.classes[i].name.fullName, index.classes[i].name.fullName.replace(/(\.|_)/g, ' '), path, path.replace(/\//g, ' ') ].join(" ")
				});

		for(let i in index.docs)
			if(i !== 'README')
				item.items.push({
					type: 'document',
					label: index.docs[i].name,
					link: this.getDocumentLink(path, index.docs[i].name),
					id: "doc:" + path + "/doc." + index.docs[i].name,
					items: null,
					flags: ( index.docs[i].error ? { "error": true } : {} ),
					fulltext: [ index.docs[i].name, index.docs[i].name.replace(/(\.|_)/g, ' '), path, path.replace(/\//g, ' ') ].join(" ")
				});

		for(let i in index.dirs)
			item.items.push( this.prepareTree(index.dirs[i], path + "/" + index.dirs[i].name) );

		//Sort
		item.items.sort((a: INavItem, b: INavItem) => {
			return a.label.localeCompare(b.label);
		});

		//Return
		return item;

	}

	/**
	 * Prepares document section
	 *
	 * @param doc Inventory document
	 * @param path Current path
	 */
	protected prepareDocument(doc: IInventoryDocument, path: string) : ITextSection {

		let section = {
			title: doc.name,
			type: 'document',
			contents: null,
			sourceLink: ( doc.contents ? this.getDocumentSourceLink(path) : null ),
			errors: ( doc.error ? [ doc.error ] : [] )
		};

		section.contents = this.markdown.render(String(doc.contents));

		return section;

	}

	/**
	 * Prepares class section
	 *
	 * @param class Inventory class
	 * @param path Current path
	 */
	protected prepareClass(iClass: IInventoryClass, path: string): IClassSection {

		//Create section
		let section: IClassSection = {
			title: iClass.name.fullName,
			class: null,
			type: 'class',
			sourceLink: this.getClassSourceLink(iClass.name),
			errors: iClass.error ? [ iClass.error ] : []
		};

		//Skip if class was not resolved
		if(!iClass.class) return section;

		//Create class
		let _class: IClass = {
			className: iClass.name.fullName,
			dependencies: [],
			dependents: [],
			applications: [],
			props: null
		};

		//Add dependencies
		let createClassLink = (dClass: IDependencyClass) => {

			let _ref = this.inventory.getClassRef(dClass.name);

			let _link: IClassLink = {
				className: dClass.name,
				link: ( _ref ? this.getClassLink(_ref.name) : null ),
				dependencies: [],
				flags: ( dClass.error ? { error: true } : {} )
			};

			for(let i = 0; i < dClass.classes.length; i++)
				_link.dependencies.push( createClassLink(dClass.classes[i]) );

			return _link;

		};

		for(let i = 0; i < iClass.class.classes.length; i++)
			_class.dependencies.push( createClassLink(iClass.class.classes[i]) );

		//Add dependants
		for(let i in iClass.class.dependents){

			let _ref;

			if(iClass.class.dependents[i].type == CLASS_TYPE.CLASS)
				_ref = this.inventory.getClassRef(iClass.class.dependents[i].name);
			else
				_ref = this.inventory.getNodeRef(iClass.class.dependents[i].name);

			_class.dependents.push({
				className: iClass.class.dependents[i].name,
				link: ( _ref ? this.getClassLink(_ref.name) : null ),
				dependencies: [],
				flags: {}
			});

		}

		//Add applications
		for(let i in iClass.class.applications){

			let _app = iClass.class.applications[i];

			let app: IClassApp = {
				name: i,
				sources: [],
				comment: [],
				ownProp: false
			};

			for(let j = 0; j < _app.sources.length; j++){
			
				let _ref;

				if(_app.sources[j].classType == CLASS_TYPE.CLASS)
					_ref = this.inventory.getClassRef(_app.sources[j].className);
				else
					_ref = this.inventory.getNodeRef(_app.sources[j].className);

				app.sources.push({
					className: _app.sources[j].className,
					classLink: ( _ref ? this.getClassLink(_ref.name) : null ),
					sourceLink: ( _ref ? this.getClassSourceLink(_ref.name) : null ),
					comment: _app.sources[j].comment.join("\n")
				});

				if(_app.sources[j].comment.length > 0)
					app.comment.unshift(_app.sources[j].comment.join("\n"));

				if(j === _app.sources.length - 1){

					if(_ref == iClass)
						app.ownProp = true;

				}

			}

			_class.applications.unshift(app);

		}

		//Prepare props
		let type2str = (type: TOKEN_TYPE) => {

			switch(type){

				case TOKEN_TYPE.MAP: return 'map';
				case TOKEN_TYPE.SEQUENCE: return 'sequence';
				case TOKEN_TYPE.VALUE: return 'value';

			}

		};

		let merge2str = (type: MERGE_TYPE) => {

			switch(type){

				case MERGE_TYPE.MERGED: return 'merged';
				case MERGE_TYPE.REPLACED: return 'replaced';
				case MERGE_TYPE.ORIGIN: return 'origin';

			}

		};

		let prepareProp = (name: string, param: IResolvedParam, prefix: string = null) : IClassProp => {

			//Prepare prop
			let prop : IClassProp = {
				id: ( prefix !== null ? prefix + ":" : "" ) + ( name !== null ? name : "param" ),
				name: name,
				type: type2str(param.type),
				ownProp: false,
				value: null,
				ref: null,
				comment: [],
				sources: [],
				fulltext: null
			};

			let fulltext = [ prop.id.substr(6).replace(/\:/g, '.') ];

			if(prop.name){
				fulltext.push( prop.name);
				fulltext.push( prop.name.replace(/_/g, ' ') );
			}

			//Add sources
			for(let i = 0; i < param.sources.length; i++){

				let _source = param.sources[i];

				let _sourceRef;

				if(_source.classType === CLASS_TYPE.CLASS)
					_sourceRef = this.inventory.getClassRef(_source.className);
				else
					_sourceRef = this.inventory.getNodeRef(_source.className);

				let source: IClassPropSource = {
					className: _source.className,
					classLink: ( _sourceRef ? this.getClassLink(_sourceRef.name) + "#" + prop.id : null ),
					sourceLink: ( _sourceRef ? this.getClassSourceLink( _sourceRef.name ) + "#line:" + (_source.token.line + 1) : null ),
					mergeType: merge2str(_source.mergeType),
					type: type2str(_source.type),
					value: _source.value,
					comment: _source.comment.join("\n")
				};

				prop.sources.unshift(source);

				if(prop.comment.indexOf(source.comment) < 0)
					prop.comment.unshift(source.comment);

				if(i === param.sources.length - 1){

					if(_sourceRef == iClass)
						prop.ownProp = true;

				}

				if(fulltext.indexOf(source.value) < 0)
					fulltext.push( source.value );

				if(fulltext.indexOf( source.comment ) < 0)
					fulltext.push( source.comment );

			}

			//Set value
			if(param.value !== null){

				if(param.type === TOKEN_TYPE.MAP){

					prop.value = {};

					for(let i in param.value)
						prop.value[i] = prepareProp(i, param.value[i], prop.id);

				} else if(param.type === TOKEN_TYPE.SEQUENCE){

					prop.value = new Array(param.value.length);

					for(let i = 0; i < param.value.length; i++)
						prop.value[i] = prepareProp(String(i), param.value[i], prop.id);

				} else if(String(param.value).substr(0, 7) == "#!ref!#"){

					prop.type = 'ref';
					prop.value = "#param:" + String(param.value).substr(7);

					fulltext.push( String(param.value).substr(7) );

				} else {

					prop.value = param.value;

					fulltext.push(prop.value);

				}

			}

			//Set refs
			if(param.ref){

				prop.ref = [];

				for(let i = 0; i < param.ref.length; i++){
					
					prop.ref.push({
						name: param.ref[i].substr(2, param.ref[i].length - 3),
						link: "#param:" + param.ref[i].substr(2, param.ref[i].length - 3)
					});

					fulltext.push( param.ref[i].substr(2, param.ref[i].length - 3) );

				}

			}

			prop.fulltext = fulltext.join(" ");

			return prop;

		}

		if(iClass.class.params)
			_class.props = prepareProp(null, iClass.class.params, null);

		section.class = _class;

		return section;

	}

	/**
	 * Prepares class list section
	 *
	 * @param index Inventory index
	 * @param path Current path
	 */
	protected prepareClassList(index: IInventoryIndex, path: string): IClassListSection {

		let section: IClassListSection = {
			type: 'class-list',
			classes: []
		};

		for(let i in index.classes){

			if(i == 'init') continue;

			section.classes.push({
				label: index.classes[i].name.fullName,
				link: this.getClassLink(index.classes[i].name),
				flags: ( index.classes[i].error ? { error: true } : {} )
			});

		}

		for(let i in index.dirs){

			let _index = index.dirs[i];

			section.classes.push({
				label: _index.classes['init'] ? _index.classes['init'].name.fullName : _index.name,
				link: this.getDirectoryLink(path + "/" + _index.name),
				flags: ( _index.classes['init'] && _index.classes['init'].error ? { error: true } : {} )
			});

		}

		return section;

	}

	/**
	 * Prepares source code section
	 *
	 * @param filename Filename
	 */
	protected prepareSource(filename: string, lang: string){

		let section: ISourceSection = {
			type: 'source',
			title: filename.split("/").pop(),
			contents: null
		};

		if (!hljs.getLanguage(lang))
			throw new Error("Unsupported source language: " + lang);
		
		let code = fs.readFileSync(filename, { encoding: 'utf-8' });
		let html = hljs.highlight(lang, code).value;
		let lines = html.split("\n");

		section.contents = '';

		for(let i = 0; i < lines.length; i++)
			section.contents+= '<div class="code-line" id="line:' + (i + 1) + '"><span class="code-line-nr">' + (i + 1) + '</span>' + lines[i] + '</div>';

		//section.contents = this.markdown.render('```' + lang + '\n' + code + '\n```');

		return section;

	}

	/**
	 * Renders index page
	 *
	 * @param index Inventory index
	 */
	protected renderIndex(index: IInventoryIndex){

		//Prepare page
		let page: IIndexPage = {
			type: 'overview',
			label: 'Overview',
			title: 'Overview',
			crumbs: [],
			sections: {},
			id: 'overview'
		};

		let _crumbs = [];

		_crumbs.push({
			label: "Overview",
			link: "{{base}}/index.html"
		});

		//Add readme
		if(index.docs['README']){
			page.sections['readme'] = this.prepareDocument(index.docs['README'], "/README");
			this.renderSource(index.docs['README'].filename, "/README", _crumbs, 'markdown');
		}

		//Add nodes
		if(index.dirs['nodes'])
			page.sections['nodes'] = this.prepareClassList(index.dirs['nodes'], this.nodesDir);

		//Add classes
		if(index.dirs['classes'])
			page.sections['classes'] = this.prepareClassList(index.dirs['classes'], this.classesDir);

		let outputFilename = this.outputDir + '/index.html';

		try {

			this.logger.info("Rendering index to '" + outputFilename + "'...");

			let html = this.renderTpl("index", {
				title: page.title,
				page: page
			});

			html = this.filterOutput(html, '');

			fs.writeFileSync(outputFilename, html, { encoding: 'utf-8' });

		} catch(err) {

			this.logger.warn("Failed to render index:", err);

		}

	}

	/**
	 * Renders source code
	 *
	 * @param filename Source filename
	 * @param path Index path
	 * @param crumbs Previous index crumbs
	 * @param lang Code language
	 */
	protected renderSource(filename: string, path: string, crumbs: Array<ICrumb> = [], lang: string){

		//Prepare page
		let page: IPage = {
			type: 'source',
			label: filename.split("/").pop(),
			title: 'File ' + filename.split("/").pop(),
			crumbs: crumbs,
			sections: [],
			id: "source:" + path
		};

		//Add source section
		page.sections.push( this.prepareSource(filename, lang) );

		//Render page
		try {

			let outputFilename = this.outputDir + path + ".source.html";

			this.logger.info("Rendering source page to '" + outputFilename + "'...");

			let html = this.renderTpl("page", {
				title: page.title,
				page: page
			});

			html = this.filterOutput(html, path);

			fs.writeFileSync(outputFilename, html, { encoding: 'utf-8' });

		} catch(err) {

			this.logger.warn("Failed to render source page:", err);

		}

	}

	/**
	 * Renders document
	 *
	 * @param doc Inventory document
	 * @param path Index path
	 * @param crumbs Previous index crumbs
	 * @param force If to ignore cache
	 */
	protected renderDocument(doc: IInventoryDocument, path: string, crumbs: Array<ICrumb> = [], force: boolean = false){

		//Prepare page
		if(this.cache[path] != doc.fingerprint || force){

			this.cache[path] = doc.fingerprint

			//Update crumbs
			let _crumbs = crumbs.slice();

			_crumbs.push({
				label: doc.name,
				link: "{{base}}" + path + ".html"
			});

			let page: IPage = {
				type: 'document',
				title: doc.name,
				label: doc.name,
				crumbs: crumbs,
				sections: [],
				id: "doc:" + path
			};

			//Add content
			page.sections.push( this.prepareDocument(doc, path) );
			this.renderSource(doc.filename, path, _crumbs, 'markdown');

			//Render page
			try {

				let outputFilename = this.outputDir + path + ".html";

				this.logger.info("Rendering document page to '" + outputFilename + "'...");

				let html = this.renderTpl("page", {
					title: page.title,
					page: page
				});

				html = this.filterOutput(html, path);

				fs.writeFileSync(outputFilename, html, { encoding: 'utf-8' });

			} catch(err) {

				this.logger.warn("Failed to render document page:", err);

			}

		}

	}

	/**
	 * Renders class
	 *
	 * @param doc Inventory class
	 * @param path Index path
	 * @param crumbs Previous index crumbs
	 * @param force If to ignore cache
	 */
	protected renderClass(rClass: IInventoryClass, path: string, crumbs: Array<ICrumb> = [], force: boolean = false){

		//Prepare page
		if((rClass.class && this.cache[path] != rClass.class.fingerprint) || force){

			if(rClass.class)
				this.cache[path] = rClass.class.fingerprint;

			//Update crumbs
			let _crumbs = crumbs.slice();

			_crumbs.push({
				label: rClass.name.fullName,
				link: this.getClassLink(rClass.name)
			});

			let page: IPage = {
				type: 'class',
				title: 'Class ' + rClass.name.fullName,
				label: rClass.name.name,
				crumbs: crumbs,
				sections: [],
				id: "class:" + rClass.name.fullName
			};

			//Add content
			page.sections.push( this.prepareClass(rClass, path) );
			this.renderSource(rClass.filename, path, _crumbs, 'yaml');

			//Render page
			try {

				let outputFilename = this.outputDir + path + ".html";

				this.logger.info("Rendering class page to '" + outputFilename + "'...");

				let html = this.renderTpl("page", {
					title: page.title,
					page: page
				});

				html = this.filterOutput(html, path);

				fs.writeFileSync(outputFilename, html, { encoding: 'utf-8' });

			} catch(err) {

				this.logger.warn("Failed to render class page:", err);

			}

		}

	}

	/**
	 * Renders index (directory)
	 *
	 * @param index Inventory index
	 * @param path Index path
	 * @param crumbs Previous index crumbs
	 * @param force If to ignore cache
	 */
	protected renderDirectory(index: IInventoryIndex, path: string, crumbs: Array<ICrumb> = [], force: boolean = false){

		//Check directory
		let outputDir = this.outputDir + path;

		if(!fs.existsSync(outputDir)){
			this.logger.info("Creating directory '" + outputDir + "'...");
			fs.mkdirSync(outputDir);
		}

		//Update crumbs
		let _crumbs = crumbs.slice();

		_crumbs.push({
			label: index.name,
			link: this.getDirectoryLink(path)
		});

		//Prepare page
		if(this.cache[path] != index.contentFingerprint || force){

			this.cache[path] = index.contentFingerprint;

			let page: IPage = {
				type: ( index.classes['init'] ? 'class' : 'directory' ),
				title: ( index.classes['init'] ? 'Class ' + index.classes['init'].name.fullName : 'Directory ' + index.name ),
				label: index.name,
				crumbs: crumbs,
				sections: [],
				id: "dir:" + path
			};

			//Add readme
			if(index.docs['README']){
				page.sections.push( this.prepareDocument(index.docs['README'], path + "/README") );
				this.renderSource(index.docs['README'].filename, path + "/README", _crumbs, 'markdown');
			}

			//Add subclasses
			if((index.classes['init'] && Object.keys(index.classes).length > 1) || (!index.classes['init'] && Object.keys(index.classes).length > 0) || Object.keys(index.dirs).length > 0)
				page.sections.push( this.prepareClassList(index, path) );

			//Add class
			if(index.classes['init']){
				page.sections.push( this.prepareClass(index.classes['init'], path + "/init") );
				this.renderSource(index.classes['init'].filename, path + "/init", _crumbs, 'yaml');
			}

			//Render page
			try {

				let outputFilename = this.outputDir + path + "/index.html";

				this.logger.info("Rendering dir page to '" + outputFilename + "'...");

				let html = this.renderTpl("page", {
					title: page.title,
					page: page
				});

				html = this.filterOutput(html, path + "/");

				fs.writeFileSync(outputFilename, html, { encoding: 'utf-8' });

			} catch(err) {

				this.logger.warn("Failed to render dir page:", err);

			}

		}

		//Render classes
		for(let i in index.classes){

			if(i == "init") continue;

			try {

				this.renderClass(index.classes[i], path + "/class." + index.classes[i].name.name, _crumbs, force );

			} catch(err) {

				this.logger.error("Failed to render '" + path + "/class." + index.classes[i].name.name + "':", err);

			}

		}

		//Render documents
		for(let i in index.docs){

			if(i == "README") continue;

			try {

				this.renderDocument(index.docs[i], path + "/doc." + index.docs[i].name, _crumbs, force );

			} catch(err) {

				this.logger.error("Failed to render '" + path + "/doc." + index.docs[i].name + "':", err);

			}

		}

		//Render sub directories
		for(let i in index.dirs){

			try {
				
				this.renderDirectory(index.dirs[i], path + "/" + i, _crumbs, force);

			} catch(err){

				this.logger.error("Failed to render '" + (path + "/" + i) +"':", err);

			}

		}

	}

	/**
	 * Copy assets from template to output for given directory
	 *
	 * @param path Path
	 */
	protected copyAssets(srcDir: string, dstDir: string, path: string){

		let realPath = srcDir + path;
		let dstPath = this.outputDir + dstDir + path;

		this.logger.debug("Checking assets in '" + realPath + "'...");

		//Check output dir
		if(!fs.existsSync(dstPath)){
			
			this.logger.info("Creating directory '" + dstPath + "'...");
			fs.mkdirSync(dstPath);

		}

		//Read dir
		let files = fs.readdirSync(realPath);

		for(let i in files){

			let file = files[i];

			if(file == "." || file == ".." || file.substr(0, 1) == ".")
				continue;

			let srcFilename = srcDir + path + "/" + file;
			let dstFilename = this.outputDir + dstDir + path + "/" + file;
			let assetId = "__assets__" + srcDir + path + "/" + file;

			let stat = fs.statSync(srcFilename);

			if(stat.isDirectory()){

				try {
					
					this.copyAssets(srcDir, dstDir, path + "/" + file);

				} catch(err) {

					this.logger.error("Failed to create asset directory '" + dstFilename +  "':", err);

				}

			} else {

				if(this.cache[assetId] == String(stat.mtime.getTime())){
					this.logger.debug("Asset file '" + dstFilename + "' up to date, skiping...");
					continue;
				}

				this.logger.info("Copying asset file '" + dstFilename + "'...");

				//Copy file
				try {
					
					fsExtra.copySync(srcFilename, dstFilename, {
						overwrite: true
					});

				} catch(err) {

					this.logger.error("Failed to copy asset file '" + srcFilename +  "' to '" + dstFilename + "':", err);

				}

				this.cache[assetId] = String(stat.mtime.getTime());

			}

		}

	}

	/**
	 * Returns if template file has changed
	 *
	 * @param name Template name
	 * @param updateCache If to update cached value
	 */
	protected hasTemplateChanged(path: string){

		let files = fs.readdirSync(path);

		for(let i in files){

			let file = files[i];
			let filename = path + "/" + file;

			let stat = fs.statSync(filename);

			if(stat.isDirectory()){

				let res = this.hasTemplateChanged(path + "/" + file);

				if(res) return true;

			} else {

				if(file.substr(file.length - 4, 4) !== ".pug")
					continue;

				if(this.cache['__template__/' + path] != String(stat.mtime.getTime())){

					this.cache['__template__/' + path] = String(stat.mtime.getTime());
					return true;

				}

			}

		}

		return false;

	}

	/**
	 * Renders all items in inventory
	 *
	 * @param index Inventory index
	 */
	public render(index: IInventoryIndex, treeHash: string){

		//Check output directory
		if(!fs.existsSync(this.outputDir)){
			this.logger.info("Creating output directory '" + this.outputDir + "'...");
			fsExtra.mkdirpSync(this.outputDir);
		}

		//Copy assets
		this.copyAssets(this.templateDir + this.assetsSrcDir, this.assetsOutDir, "");

		//Copy media files
		if(fs.existsSync(this.mediaSrcDir))
			this.copyAssets(this.mediaSrcDir, this.mediaOutDir, "");

		//Check if template has changed
		let tplChanged = this.hasTemplateChanged(this.templateDir);

		if(tplChanged){
			this.tplCache = {};
			this.logger.debug("Template changed, will rebuild all...");
		}

		//Update globals
		this.globals['navTree'] = {
			classes: this.prepareTree( index.dirs['classes'], this.classesDir ),
			nodes: this.prepareTree( index.dirs['nodes'], this.nodesDir )
		};

		//Render index
		if(this.cache[index.path] !== index.fingerprint)
			this.renderIndex(index);

		let crumbs = [{
			label: "Overview",
			link: "{{base}}/index.html"
		}];

		//Render nodes
		this.renderDirectory(index.dirs['nodes'], this.nodesDir, crumbs, tplChanged);

		//Render classes
		this.renderDirectory(index.dirs['classes'], this.classesDir, crumbs, tplChanged);

	}

}