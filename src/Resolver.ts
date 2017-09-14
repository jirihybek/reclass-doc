/**
 * Reclass doc generator
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 (c) 2017 Jiri Hybek
 */

import fs = require('fs');
import crypto = require('crypto');

import {IToken, YamlTokenizer, TOKEN_TYPE} from './YamlTokenizer';
import {clone, CLASS_TYPE} from './Util';

export enum MERGE_TYPE {
	ORIGIN,
	MERGED,
	REPLACED
}

export interface IResolvedSource {
	className: string;
	classType: CLASS_TYPE;
	token: IToken;
	type: TOKEN_TYPE;
	mergeType: MERGE_TYPE;
	value: any;
	comment: Array<string>;
}

export interface IResolvedParam {
	sources: Array<IResolvedSource>;
	type: TOKEN_TYPE;
	value: any;
	ref: Array<string>;
	comment: Array<Array<string>>;
}

export interface IDependencyClass {
	id: string;
	name: string;
	error: Error;
	classes: Array<IDependencyClass>;
}

export interface IDependentClass {
	id: string;
	type: CLASS_TYPE;
	name: string;
}

export interface IResolvedApplication {
	name: string;
	sources: Array<{
		className: string;
		classType: CLASS_TYPE;
		token: IToken;
		comment: Array<string>;
	}>;
}

export interface IResolvedClass {
	id: string;
	name: string;
	type: CLASS_TYPE;
	filename: string;
	relativePath: string;
	isInit: boolean;
	classes: Array<IDependencyClass>;
	applications: { [K: string]: IResolvedApplication };
	dependents: { [K: string] : IDependentClass },
	params: IResolvedParam;
	comment: Array<string>;
	fingerprint: string;
	modified: number;
	resolvedClasses: Array<string>;
}

/**
 * Resolver class
 *
 * Resolves class tree
 */
export class Resolver {

	/** Reclass root directory */
	protected reclassRoot: string;

	/** Classes sub-directory */
	public classesDir: string = '/classes';

	/** Nodes sub-directory */
	public nodesDir: string = '/nodes';

	/** Max depth limit */
	public depthLimit: number = 32;

	/** Cache of resolved classes */
	protected cache: { [K: string]: IResolvedClass } = {};

	/** Inverted dependency tree - class -> dependants */
	protected dependencyTree: { [K: string]: Array<string> } = {};

	/** Tokenizer instance */
	protected tokenizer: YamlTokenizer;

	/**
	 * Resolver constructor
	 *
	 * @param reclassRoot Reclass classes dir
	 */
	public constructor(reclassRoot: string){

		this.reclassRoot = reclassRoot;

		this.tokenizer = new YamlTokenizer();

	}

	/**
	 * Merges class param
	 *
	 * @param target Target param
	 * @param source Source param
	 */
	protected mergeParams(target: IResolvedParam, source: IResolvedParam){

		//Clone sources
		let _sources: Array<IResolvedSource> = [];
		let lastSource: IResolvedSource;

		for(let i = 0; i < source.sources.length; i++){

			if(i < source.sources.length - 1){
				
				_sources.push( source.sources[i] );

			} else {

				lastSource = clone(source.sources[i]);
				_sources.push(lastSource);

			}

			//Add comments
			if(source.comment.length > 0){

				for(let c in source.comment)
					if(source.comment[c].length > 0)
						target.comment.push(source.comment[c]);

				//target.comment = target.comment.concat(source.comment);
			}

		}

		//MERGE MAP
		if(target.type === TOKEN_TYPE.MAP && source.type === TOKEN_TYPE.MAP){

			lastSource.mergeType = MERGE_TYPE.MERGED;

			for(let i in source.value){

				if(target.value[i])
					this.mergeParams(target.value[i], source.value[i]);
				else
					target.value[i] = clone(source.value[i]);

			}

		//MERGE SEQUENCE
		} else if(target.type === TOKEN_TYPE.SEQUENCE && source.type === TOKEN_TYPE.SEQUENCE){

			lastSource.mergeType = MERGE_TYPE.MERGED;

			for(let i = 0; i < source.value.length; i++)
				target.value.push( clone(source.value[i]) );

		//REPLACE
		} else {

			lastSource.mergeType = MERGE_TYPE.REPLACED;

			target.value = clone(source.value);

		}

		//Add sources
		target.sources = target.sources.concat(_sources);

	}

	/**
	 * Merges token(s) to param(s)
	 *
	 * @param target Target param
	 * @param token Source token
	 * @param name Source class name
	 */
	protected parseTokenParams(token: IToken, className: string, classType: CLASS_TYPE) {

		let source: IResolvedSource = {
			className: className,
			classType: classType,
			token: token,
			type: token.type,
			mergeType: MERGE_TYPE.ORIGIN,
			value: null,
			comment: token.comment
		}

		//Define param
		let param: IResolvedParam = {
			sources: [ source ],
			type: source.type,
			value: clone(source.value),
			ref: null,
			comment: [source.comment]
		};

		//Parse map
		if(token.type === TOKEN_TYPE.MAP){

			source.value = "[map]";
			param.value = {};

			for(let i in token.value)
				param.value[i] = this.parseTokenParams(token.value[i], className, classType);

		//Parse sequence
		} else if(token.type === TOKEN_TYPE.SEQUENCE){

			source.value = "[sequence]";
			param.value = [];

			for(let i = 0; i < token.value.length; i++)
				param.value.push( this.parseTokenParams(token.value[i], className, classType) );

		//Parse vale
		} else {

			source.value = token.value;
			param.value = token.value;

		}

		return param;

	}

	/**
	 * Resolves file
	 *
	 * @param prefix Prefix directory
	 * @param name Relative file / directory path without extension
	 * @param depth Nesting depth
	 * @param loadedClasses Already loaded classes
	 */
	public resolve(prefix: string, name: string, path: string, depth: number = 0, loadedClasses: Array<string> = []){

		if(depth > this.depthLimit)
			throw new Error("Maximum class depth limit of " + this.depthLimit + " exceeded.");

		let classId = prefix + "/" + name;

		//Check cache
		if(this.cache[classId])
			return this.cache[classId];

		//Define path
		let _path = this.reclassRoot + prefix + "/" + path;
		let relativePath = prefix + "/" + name;
		let isInit: boolean = false;

		//Identify YAML
		if(fs.existsSync(_path) && fs.lstatSync(_path).isDirectory()){
			_path+= "/init";
			relativePath+= "/init";
			isInit = true;
		}

		if(fs.existsSync(_path + ".yml")){
			
			_path+= ".yml";
			relativePath+= ".yml";

		} else if(fs.existsSync(_path + ".yaml")) {
			
			_path+= ".yaml";
			relativePath+= ".yaml";

		} else{
			
			throw new Error("File '" + _path + "(init.yml|.yml|.yaml)' not found.");

		}

		//Load yaml
		let yaml = fs.readFileSync(_path, { encoding: 'utf-8' });
		let stat = fs.statSync(_path);

		//Parse tokens
		let token;

		try {
			
			token = this.tokenizer.parse(yaml);

		} catch(err) {

			throw new Error("YAML parse error: " + String(err));

		}

		if(!token)
			throw new Error("Class '" + name + "' file is empty.");

		//Prepare class instance
		let rClass: IResolvedClass = {
			id: classId,
			name: name,
			type: ( prefix == this.nodesDir ? CLASS_TYPE.NODE : CLASS_TYPE.CLASS ),
			filename: _path,
			relativePath: relativePath,
			isInit: isInit,
			classes: [],
			applications: {},
			dependents: {},
			params: {
				type: TOKEN_TYPE.MAP,
				sources: [],
				value: {},
				ref: null,
				comment: []
			},
			comment: token.comment,
			fingerprint: null,
			modified: stat.mtime.getTime(),
			resolvedClasses: []
		};

		let fingerprint = crypto.createHash('md5').update(_path + ":" + stat.mtime);

		//Parse classes
		if(token.value['classes']){

			let _classesToken: IToken = token.value['classes'];

			if(_classesToken.type != TOKEN_TYPE.SEQUENCE)
				throw new Error("Error parsing class '" + classId + "', 'classes' are not sequence type.");

			for(let i = 0; i < _classesToken.value.length; i++){

				let _classToken: IToken = _classesToken.value[i];
				let _classId = this.classesDir + "/" + _classToken.value;

				if(rClass.resolvedClasses.indexOf(_classToken.value) >= 0)
					continue;

				let _resolvedClass = {
					id: _classId,
					name: _classToken.value,
					classes: [],
					error: null
				}

				rClass.resolvedClasses.push(_classToken.value);

				try {
					
					let _class = this.resolveClass(_classToken.value, depth + 1, loadedClasses);

					//Create dependency tree
					_class.dependents[classId] = {
						id: classId,
						type: rClass.type,
						name: rClass.name
					};

					_resolvedClass.classes = _class.classes;

					if(!this.dependencyTree[_classId])
						this.dependencyTree[_classId] = [];

					if(this.dependencyTree[_classId].indexOf(classId) < 0)
						this.dependencyTree[_classId].push(classId);

					//Merge params if not already merged elsewhere
					//if(loadedClasses.indexOf(_class.id) < 0){

						//Merge applications
						for(let j in _class.applications){

							if(!rClass.applications[j])
								rClass.applications[j] = clone(_class.applications[j]);
							else
								rClass.applications[j].sources = _class.applications[j].sources.concat(rClass.applications[j].sources);

						}

						//Merge params
						this.mergeParams(rClass.params, _class.params);

						//Add to loaded classes
						loadedClasses.push(_class.id);

						//Update fingerprint
						fingerprint.update(_class.fingerprint);

					//}

				} catch(err) {

					_resolvedClass.error = err;

				}

				rClass.classes.push(_resolvedClass);

			}

		}

		//Add applications
		if(token.value['applications']){

			let _appsToken: IToken = token.value['applications'];

			if(_appsToken.type !== TOKEN_TYPE.SEQUENCE)
				throw new Error("Error parsing class '" + classId + "', 'applications' are not sequence type.");

			if(_appsToken.value instanceof Array)
				for(let i = 0; i < _appsToken.value.length; i++){

					let _appToken = _appsToken.value[i];

					if(!rClass.applications[_appToken.value])
						rClass.applications[_appToken.value] = {
							name: _appToken.value,
							sources: []
						};

					rClass.applications[_appToken.value].sources.push({
						className: rClass.name,
						classType: rClass.type,
						token: _appToken,
						comment: _appToken.comment
					});

				}

		}

		//Add params
		if(token.value['parameters']){

			let _paramsToken: IToken = token.value['parameters'];

			if(_paramsToken.type !== TOKEN_TYPE.MAP)
				throw new Error("Error parsing class '" + classId + "', 'parameters' are not map type.");

			let localParams = this.parseTokenParams(_paramsToken, rClass.name, rClass.type);

			this.mergeParams(rClass.params, localParams);

		}

		//Store fingerprint
		rClass.fingerprint = fingerprint.digest('hex');

		this.cache[classId] = rClass;

		return rClass;

	}

	/**
	 * Parses params interpolation
	 *
	 * @param rootParam Root parameter
	 * @param param Current parameter
	 */
	protected parseInterpolation(rootParam: IResolvedParam, param: IResolvedParam){

		if(param.type === TOKEN_TYPE.MAP){

			if(param.value instanceof Object)
				for(let i in param.value)
					this.parseInterpolation(rootParam, param.value[i]);

		} else if(param.type === TOKEN_TYPE.SEQUENCE){

			if(param.value instanceof Array)
				for(let i = 0; i < param.value.length; i++)
					this.parseInterpolation(rootParam, param.value[i]);

		} else if(typeof param.value === 'string') {

			let resolved = false;

			while(!resolved){

				let pattern = new RegExp(/\${[^}]+}/g);
				let ip;
				let replacements = [];

				resolved = true;

				while((ip = pattern.exec(param.value))){

					let refKey = ip[0].substr(2, ip[0].length - 3);
					let refPath = refKey.split(":");

					let stack = rootParam;
					let key;

					while((key = refPath.shift())){

						if(stack.value instanceof Object && stack.value[key] !== undefined)
							stack = stack.value[key];
						else {
							stack = null;
							break;
						}

					}

					replacements.push({
						key: ip[0],
						value: ( stack ? ( stack.value instanceof Object ? "#!ref!#" + ip[0].substr(2, ip[0].length - 3) : stack.value ) : null )
					});

				}

				if(replacements.length > 0){

					if(param.ref === null)
						param.ref = [];
					
					resolved = false;

				}

				for(let i = 0; i < replacements.length; i++){

					param.ref.push(replacements[i].key);

					if(param.value === replacements[i].key)
						param.value = replacements[i].value;
					else
						param.value = param.value.replace(replacements[i].key, replacements[i].value);

				}

			}

		}

	}

	/**
	 * Returns new class instance with interpolated params
	 *
	 * @param rClass Original class
	 */
	public interpolateClass(rClass: IResolvedClass){

		//Define new class with cloned params
		let nClass: IResolvedClass = {
			id: rClass.id,
			name: rClass.name,
			type: rClass.type,
			filename: rClass.filename,
			relativePath: rClass.relativePath,
			isInit: rClass.isInit,
			classes: rClass.classes,
			applications: rClass.applications,
			dependents: rClass.dependents,
			params: clone(rClass.params),
			//params: rClass.params,
			comment: rClass.comment,
			fingerprint: rClass.fingerprint,
			modified: rClass.modified,
			resolvedClasses: rClass.resolvedClasses
		}

		this.parseInterpolation(nClass.params, nClass.params);

		return nClass;

	}

	/**
	 * Resolves class
	 *
	 * @param name Class name
	 * @param depth Nesting depth
	 * @param loadedClasses Already loaded classes
	 */
	public resolveClass(name: string, depth: number = 0, loadedClasses: Array<string> = []){

		return this.resolve(this.classesDir, name, name.replace(/\./g, '/'), depth, loadedClasses);

	}

	/**
	 * Resolves node
	 *
	 * @param name Node name
	 * @param interpolate If to interpolate params
	 * @param depth Nesting depth
	 */
	public resolveNode(name: string, interpolate: boolean = true, depth: number = 0){

		let rClass = this.resolve(this.nodesDir, name, name, depth);

		if(interpolate)
			return this.interpolateClass(rClass);
		else
			return rClass;

	}

	/**
	 * Invalidate class and it's dependents
	 *
	 * @param classId Class ID
	 */
	public invalidate(classId: string){

		console.log("INVALIDATING", classId);

		//Delete from cache
		if(this.cache[classId])
			delete this.cache[classId];

		//Invalidate dependants
		if(this.dependencyTree[classId]){

			for(let i = 0; i < this.dependencyTree[classId].length; i++)
				if(this.cache[ this.dependencyTree[classId][i] ])
					this.invalidate(this.dependencyTree[classId][i]);

		}

	}

	/**
	 * Invalidates all modified classes in cache
	 */
	public invalidateModified(){

		for(let i in this.cache){

			let _class = this.cache[i];
			if(!_class) continue;

			let stat: fs.Stats;

			if(fs.existsSync(_class.filename))
				stat = fs.statSync(_class.filename);

			if(!stat || stat.mtime.getTime() != _class.modified)
				this.invalidate(_class.id);

		}

	}

	/**
	 * Returns dependency tree
	 */
	public getDependencyTree(){

		return this.dependencyTree;

	}

	/**
	 * Returns list of cached entities
	 */
	public getCacheList(){

		return Object.keys(this.cache);

	}

	/**
	 * Returns cached class by ID
	 *
	 * @param classId Class ID
	 */
	public getCachedClass(classId: string){

		return this.cache[classId] || null;

	}

}