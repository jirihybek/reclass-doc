/**
 * Reclass doc generator
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 (c) 2017 Jiri Hybek
 */

import {compose} from 'yaml-js';

export enum TOKEN_TYPE {
	MAP,
	SEQUENCE,
	VALUE
}

/**
 * Token interface
 */
export interface IToken {
	tag: string;
	path: string;
	type: TOKEN_TYPE;
	comment: Array<string>;
	value: any;
	line: number;
	column: number;
	pointer: number;
}

/**
 * YAML tokenizer calss
 */
export class YamlTokenizer {

	/**
	 * Parse yaml from string
	 *
	 * @param src Source
	 */
	public parse(src: string): IToken {

		let ast = compose(src);
		let lastPointer = 0;

		let parseNode = (node, path: string = null, skipComments = false) : IToken => {

			if(!node) return null;

			let token: IToken = {
				path: path,
				tag: node.tag,
				type: null,
				comment: [],
				value: null,
				line: node.start_mark.line,
				column: node.start_mark.column,
				pointer: node.start_mark.pointer
			}

			//Parse comments
			if(!skipComments){
			
				let haystack = src.substr(lastPointer, node.start_mark.pointer - lastPointer);
				let _lines = haystack.split("\n");

				for(let i = 0; i < _lines.length; i++){

					let _line = _lines[i];

					if(_line.trim().substr(0, 1) == "#")
						token.comment.push(_line.trim().substr(1).trim());

				}

				lastPointer = node.start_mark.pointer;

			}

			//Parse value
			if(node.tag == 'tag:yaml.org,2002:map'){

				token.type = TOKEN_TYPE.MAP;
				token.value = {};

				for(let i = 0; i < node.value.length; i++){

					let key = parseNode(node.value[i][0], path + "." + i + "$");
					let value =  parseNode(node.value[i][1], path + '.' + key.value, true);

					value.comment = key.comment.concat(value.comment);

					token.value[key.value] = value;

				}

			} else if(node.tag == 'tag:yaml.org,2002:seq'){

				token.type = TOKEN_TYPE.SEQUENCE;
				token.value = [];

				for(let i = 0; i < node.value.length; i++){
					
					let value = parseNode(node.value[i], path + "." + i);

					token.value.push( value );

				}

			} else {

				token.type = TOKEN_TYPE.VALUE;
				token.value = node.value;

			}

			return token;

		};

		//Parse document comments
		let _lines = src.split("\n");
		let _docComment = [];
		let _breaked = false;

		for(let i = 0; i < _lines.length; i++){

			let _line = _lines[i];

			if(_line.trim().substr(0, 1) == "#"){
				_docComment.push(_line.trim().substr(1).trim());
				lastPointer+= _line.length + 1;
			} else if(_line.trim() == "" ) {
				_breaked = true;
				break;
			} else {
				break;
			}

		}

		if(!_breaked) lastPointer = 0;

		let rootNode = parseNode(ast, 'root', true);

		if(!rootNode) return null;

		if(_breaked)
			rootNode.comment = _docComment.concat(rootNode.comment);

		return rootNode;

	}
	
}