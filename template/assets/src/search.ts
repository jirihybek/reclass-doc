/**
 * Reclass doc generator
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 (c) 2017 Jiri Hybek
 */

export interface ISearchItem {
	id: string;
	el: HTMLElement;
	parent?: ISearchItem;
	matched: boolean;
}

export interface ISearchIndex {
	keywords: { [ K: string ]: Array<ISearchItem> };
	items: Array<ISearchItem>;
}

export function buildSearchIndex(container: HTMLElement, itemSelector: string) : ISearchIndex {

	let indexKeywords: { [ K: string ]: Array<ISearchItem> } = {};
	let indexItems: Array<ISearchItem> = [];

	let parseItems = (parent: HTMLElement, parentItem: ISearchItem = null) => {

		let items = parent.querySelectorAll(itemSelector);

		for(let i = 0; i < items.length; i++){

			let _item = <HTMLElement> items.item(i);

			//Create search item
			let searchItem: ISearchItem = {
				id: ( parentItem ? parentItem.id + ":" : "" ) + i,
				el: _item,
				parent: parentItem,
				matched: false
			};

			_item.classList.add('search-item');

			indexItems.push(searchItem);

			if(_item.hasAttribute('data-fulltext')){

				//Parse keywords
				let keywords = _item.getAttribute('data-fulltext').split(" ");

				//Add to index
				for(let k = 0; k < keywords.length; k++){

					let term = keywords[k].toLowerCase();

					if(indexKeywords[term] === undefined)
						indexKeywords[term] = [];

					indexKeywords[term].push(searchItem);

				}

			}

			//Parse children
			parseItems(_item, searchItem);

		}

	};

	parseItems(container);

	return {
		keywords: indexKeywords,
		items: indexItems
	}

}

export function search(index: ISearchIndex, term: string){

	//Split term into keywords
	let keywords = term.split(" ");

	let indexKeywords = index.keywords;
	let indexItems = index.items;

	let matches: { [K: string]: {
		item: ISearchItem;
		keywords: { [K: string]: boolean };
	} } = {};

	//Reset matches
	for(let i = 0; i < indexItems.length; i++)
		indexItems[i].matched = false;

	if(term.length > 0){

		//Process search
		for(let i = 0; i < keywords.length; i++){

			let _kw = keywords[i].toLowerCase();

			for(let j in indexKeywords){

				let _match = false;

				//Exact match
				if(j == _kw){
					
					_match = true;

				//Substr match
				} else if(_kw.length > 0) {

					if(j.indexOf(_kw) >= 0)
						_match = true;

				}

				if(_match){

					for(let p = 0; p < indexKeywords[j].length; p++){
						
						let _matchItem = indexKeywords[j][p];

						//Add to matches if not alreay
						if(!matches[ _matchItem.id ])
							matches[ _matchItem.id ] = {
								item: _matchItem,
								keywords: {}
							};

						if(!matches[ _matchItem.id ].keywords[ _kw ])
							matches[ _matchItem.id ].keywords[ _kw ] = true;

					}

				}

			}

		}

		//Activate matches
		let toggleItem = (item: ISearchItem) => {

			item.matched = true;

			if(item.parent && !item.parent.matched)
				toggleItem(item.parent);

		};

		for(let i in matches){

			let skip = false;

			for(let k in keywords)
				if(!matches[i].keywords[ keywords[k].toLowerCase() ]){
					skip = true;
					break;
				}

			if(skip) continue;

			toggleItem(matches[i].item);

		}

	}

	//Update classes
	for(let i = 0; i < indexItems.length; i++){

		if( indexItems[i].matched && !indexItems[i].el.classList.contains('search-match') )
			indexItems[i].el.classList.add('search-match');
		else if( !indexItems[i].matched && indexItems[i].el.classList.contains('search-match') )
			indexItems[i].el.classList.remove('search-match');

	}

}